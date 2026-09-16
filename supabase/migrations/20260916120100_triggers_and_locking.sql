-- Server-side enforcement of the rules in docs/datamodel.md §6 and 3.16.
-- These live in the database rather than the app on purpose: the app runs on a
-- device the inspector controls, and evidence rules that only exist client-side
-- are not evidence rules.

-- ---------------------------------------------------------------------------
-- updated_at is maintained by the device (§6.3). The server only fills it in
-- when a row arrives without one, so backoffice writes stay consistent.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is null or new.updated_at = old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'users', 'user_invitations', 'properties', 'room_templates',
    'inspections', 'rooms', 'room_elements', 'photos', 'meter_readings', 'keys',
    'inspection_parties', 'ai_suggestions', 'mail_log'
  ] loop
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status flow (3.4). Only these transitions are allowed.
-- ---------------------------------------------------------------------------
create or replace function allowed_inspection_transition(from_status text, to_status text)
returns boolean
language sql
immutable
as $$
  select case from_status
    when 'draft'               then to_status in ('in_progress')
    when 'in_progress'         then to_status in ('awaiting_signatures')
    when 'awaiting_signatures' then to_status in ('in_progress', 'signed')
    when 'signed'              then to_status in ('pending_sync')
    when 'pending_sync'        then to_status in ('synced')
    when 'synced'              then to_status in ('ai_processing', 'review')
    when 'ai_processing'       then to_status in ('review')
    when 'review'              then to_status in ('approved')
    when 'approved'            then to_status in ('sent')
    when 'sent'                then to_status in ('archived')
    else false
  end;
$$;

create or replace function enforce_inspection_status_flow()
returns trigger
language plpgsql
as $$
declare
  open_conflicts integer;
  unsigned_parties integer;
  unfinished_rooms integer;
begin
  if new.status = old.status then
    return new;
  end if;

  if not allowed_inspection_transition(old.status, new.status) then
    raise exception 'Invalid inspection status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- 3.7 / 3.16: an inspection cannot reach `signed` while an element is waiting
  -- for a human to choose between two devices' versions.
  if new.status = 'signed' then
    select count(*) into open_conflicts
      from room_elements e
      join rooms r on r.id = e.room_id
     where r.inspection_id = new.id
       and e.sync_conflict_status = 'pending_review'
       and e.deleted_at is null;

    if open_conflicts > 0 then
      raise exception 'Inspection % has % unresolved element conflict(s)', new.id, open_conflicts
        using errcode = 'check_violation';
    end if;

    -- §6.5: every room complete, every party that must sign has signed.
    select count(*) into unfinished_rooms
      from rooms where inspection_id = new.id and deleted_at is null and is_completed = false;
    if unfinished_rooms > 0 then
      raise exception 'Inspection % has % unfinished room(s)', new.id, unfinished_rooms
        using errcode = 'check_violation';
    end if;

    select count(*) into unsigned_parties
      from inspection_parties p
     where p.inspection_id = new.id
       and p.deleted_at is null
       and p.must_sign
       and not exists (select 1 from signatures s where s.party_id = p.id);
    if unsigned_parties > 0 then
      raise exception 'Inspection % has % party/parties still to sign', new.id, unsigned_parties
        using errcode = 'check_violation';
    end if;

    new.locked_at := coalesce(new.locked_at, now());
  end if;

  return new;
end;
$$;

create trigger inspections_enforce_status_flow
  before update of status on inspections
  for each row execute function enforce_inspection_status_flow();

-- ---------------------------------------------------------------------------
-- Locking (3.16). Once locked_at is set, the inspection content is frozen.
-- ai_suggestions, reports and mail_log are deliberately not in this set.
-- ---------------------------------------------------------------------------
create or replace function reject_write_to_locked_inspection()
returns trigger
language plpgsql
as $$
declare
  target_inspection uuid;
  locked timestamptz;
  row_record record;
begin
  row_record := coalesce(new, old);

  -- room_elements hangs off a room, every other guarded table carries the
  -- inspection directly. Separate branches because PL/pgSQL plans the whole
  -- expression, and room_elements has no inspection_id column.
  if tg_table_name = 'room_elements' then
    select r.inspection_id into target_inspection
      from rooms r where r.id = row_record.room_id;
  else
    target_inspection := row_record.inspection_id;
  end if;

  select i.locked_at into locked from inspections i where i.id = target_inspection;

  if locked is not null then
    raise exception 'Inspection % is locked since %; % rows can no longer be changed',
      target_inspection, locked, tg_table_name
      using errcode = 'check_violation';
  end if;

  return row_record;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rooms', 'room_elements', 'photos', 'meter_readings', 'keys', 'inspection_parties'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on %I
         for each row execute function reject_write_to_locked_inspection()',
      t || '_reject_locked', t
    );
  end loop;
end;
$$;

-- Signatures are append-only (3.11): no update, no delete, ever.
create or replace function reject_signature_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Signatures are immutable: % is not allowed on signatures', tg_op
    using errcode = 'check_violation';
end;
$$;

create trigger signatures_immutable
  before update or delete on signatures
  for each row execute function reject_signature_mutation();

-- ---------------------------------------------------------------------------
-- Element-level conflict detection (3.7).
--
-- Two devices that changed the same element within one inspection session leave
-- no reliable "latest" write, so the incoming row is parked for review instead
-- of silently overwriting. Outside that window last-write-wins still applies.
-- ---------------------------------------------------------------------------
create or replace function detect_room_element_conflict()
returns trigger
language plpgsql
as $$
declare
  conflict_window constant interval := interval '4 hours';
  incoming jsonb;
  parked room_elements%rowtype;
begin
  -- A conflict resolution writes the chosen version back from the same session;
  -- it must be able to clear the flag rather than trip it again.
  if new.sync_conflict_status = 'resolved' and old.sync_conflict_status = 'pending_review' then
    return new;
  end if;

  if new.device_id = old.device_id then
    return new;
  end if;

  if old.sync_conflict_status = 'pending_review' then
    -- Already parked: keep the stored version and the first conflicting payload
    -- until a human chooses.
    return old;
  end if;

  if abs(extract(epoch from (new.client_updated_at - old.client_updated_at)))
     <= extract(epoch from conflict_window) then
    -- Capture the incoming row before discarding it, otherwise the payload a
    -- human is asked to choose is the version they already have.
    incoming := to_jsonb(new);
    parked := old;
    parked.sync_conflict_status := 'pending_review';
    parked.conflicting_payload := incoming;
    parked.updated_at := now();
    return parked;
  end if;

  if new.client_updated_at < old.client_updated_at then
    return old;
  end if;

  return new;
end;
$$;

create trigger room_elements_detect_conflict
  before update on room_elements
  for each row execute function detect_room_element_conflict();

-- ---------------------------------------------------------------------------
-- 3.17 audit_log — filled by triggers, never written by the app.
-- ---------------------------------------------------------------------------
create or replace function write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_json jsonb;
  after_json jsonb;
  row_json jsonb;
  acting_user uuid;
  org uuid;
  audit_action text;
begin
  before_json := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_json  := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  -- Read the row through jsonb: the same trigger serves tables that do not all
  -- have a device_id or an organization_id, and jsonb simply yields NULL for a
  -- key that is not there.
  row_json := coalesce(after_json, before_json);

  select u.id, u.organization_id into acting_user, org
    from users u where u.auth_user_id = auth.uid();

  -- Compared through jsonb rather than new.status/old.status: PL/pgSQL plans the
  -- whole expression, so naming a record field here fails on every table that
  -- does not have that column.
  if tg_op = 'INSERT' then
    audit_action := 'create';
  elsif tg_op = 'DELETE' then
    audit_action := 'delete';
  elsif (before_json ->> 'status') is distinct from (after_json ->> 'status') then
    audit_action := 'status_change';
  else
    audit_action := 'update';
  end if;

  insert into audit_log (organization_id, user_id, entity_type, entity_id, action, before, after, device_id)
  values (
    coalesce(
      org,
      nullif(row_json ->> 'organization_id', '')::uuid,
      case when tg_table_name = 'organizations' then nullif(row_json ->> 'id', '')::uuid end
    ),
    acting_user,
    tg_table_name,
    row_json ->> 'id',
    audit_action,
    before_json,
    after_json,
    row_json ->> 'device_id'
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'users', 'properties', 'inspections', 'rooms', 'room_elements',
    'photos', 'signatures', 'meter_readings', 'keys', 'inspection_parties',
    'reports', 'room_templates', 'report_comments'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on %I
         for each row execute function write_audit_log()',
      t || '_audit', t
    );
  end loop;
end;
$$;
