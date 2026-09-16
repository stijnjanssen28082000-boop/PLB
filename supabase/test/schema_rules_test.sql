-- Exercises the evidence rules from docs/datamodel.md that are enforced in the
-- database. Each block raises if the rule does not hold, so a non-zero exit from
-- psql -v ON_ERROR_STOP=1 means a rule regressed.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'inspecteur@voorbeeld.be');

insert into organizations (id, name, country, default_language)
values ('22222222-2222-4222-8222-222222222222', 'Testorganisatie', 'BE', 'nl');

insert into users (id, auth_user_id, organization_id, full_name, email, role, language)
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222', 'Jan Inspecteur', 'inspecteur@voorbeeld.be',
        'plaatsbeschrijver', 'nl');

insert into properties (id, organization_id, street, house_number, postal_code, city, country, region, property_type)
values ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222',
        'Teststraat', '1', '2000', 'Antwerpen', 'BE', 'vlaanderen', 'apartment');

insert into inspections (id, organization_id, property_id, type, inspector_user_id, language, device_id)
values ('55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222',
        '44444444-4444-4444-8444-444444444444', 'entry',
        '33333333-3333-4333-8333-333333333333', 'nl', 'device-a');

insert into rooms (id, inspection_id, room_template_id, room_template_version, name, sort_order, is_completed)
values ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555',
        '00000000-0000-4000-8000-000000000004', 1, 'Slaapkamer 1', 1, true);

insert into room_elements (id, room_id, element_key, condition, sort_order, device_id, client_updated_at)
values ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666',
        'wall_north', 'good', 1, 'device-a', '2026-09-16T09:00:00Z');

-- ---------------------------------------------------------------------------
-- A BE property must name its region: it decides which legislation the report
-- quotes (3.3 / 3.5c).
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into properties (organization_id, street, house_number, postal_code, city, country, property_type)
    values ('22222222-2222-4222-8222-222222222222', 'Zonderregio', '2', '1000', 'Brussel', 'BE', 'house');
    raise exception 'FAIL: a BE property was accepted without a region';
  exception when check_violation then
    raise notice 'ok: BE property requires a region';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status flow: only the documented transitions are allowed (3.4).
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update inspections set status = 'approved' where id = '55555555-5555-4555-8555-555555555555';
    raise exception 'FAIL: draft -> approved was accepted';
  exception when check_violation then
    raise notice 'ok: invalid status transition rejected';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Element-level conflict detection (3.7): a second device writing inside the
-- same session parks the row for review instead of overwriting it.
-- ---------------------------------------------------------------------------
update inspections set status = 'in_progress' where id = '55555555-5555-4555-8555-555555555555';

update room_elements
   set condition = 'damaged', description = 'Barst in de muur',
       device_id = 'device-b', client_updated_at = '2026-09-16T09:30:00Z'
 where id = '77777777-7777-4777-8777-777777777777';

do $$
declare
  stored record;
begin
  select * into stored from room_elements where id = '77777777-7777-4777-8777-777777777777';

  if stored.sync_conflict_status <> 'pending_review' then
    raise exception 'FAIL: concurrent write from a second device did not create a conflict (status %)',
      stored.sync_conflict_status;
  end if;

  -- The stored row must still be the original; the incoming version is parked.
  if stored.condition <> 'good' then
    raise exception 'FAIL: the stored version was overwritten (condition %)', stored.condition;
  end if;

  if stored.conflicting_payload ->> 'description' is distinct from 'Barst in de muur' then
    raise exception 'FAIL: conflicting_payload holds the wrong version (%)',
      stored.conflicting_payload ->> 'description';
  end if;

  raise notice 'ok: element conflict parked with the incoming version preserved';
end;
$$;

-- An inspection cannot be signed while an element conflict is open (3.16).
insert into inspection_parties (id, inspection_id, party_type, full_name, email, must_sign, receives_report)
values ('88888888-8888-4888-8888-888888888888', '55555555-5555-4555-8555-555555555555',
        'tenant', 'Huurder Test', 'huurder@voorbeeld.be', true, true);

update inspections set status = 'awaiting_signatures' where id = '55555555-5555-4555-8555-555555555555';

do $$
begin
  begin
    update inspections set status = 'signed' where id = '55555555-5555-4555-8555-555555555555';
    raise exception 'FAIL: signed while a conflict was still open';
  exception when check_violation then
    raise notice 'ok: signing blocked by an unresolved conflict';
  end;
end;
$$;

-- Resolving the conflict clears the block.
update room_elements
   set sync_conflict_status = 'resolved',
       conflict_resolved_by_user_id = '33333333-3333-4333-8333-333333333333',
       conflict_resolved_at = now()
 where id = '77777777-7777-4777-8777-777777777777';

-- Still blocked: the party that must sign has not signed yet (§6.5).
do $$
begin
  begin
    update inspections set status = 'signed' where id = '55555555-5555-4555-8555-555555555555';
    raise exception 'FAIL: signed without the required signature';
  exception when check_violation then
    raise notice 'ok: signing blocked by a missing signature';
  end;
end;
$$;

insert into signatures (inspection_id, party_id, signature_image_path, signature_sha256,
                        agrees_with_report, signed_at, device_id, app_version, report_snapshot_sha256)
values ('55555555-5555-4555-8555-555555555555', '88888888-8888-4888-8888-888888888888',
        'local/sig.png', 'deadbeef', true, now(), 'device-a', '0.1.0', 'cafebabe');

update inspections set status = 'signed' where id = '55555555-5555-4555-8555-555555555555';

do $$
declare
  locked timestamptz;
begin
  select locked_at into locked from inspections where id = '55555555-5555-4555-8555-555555555555';
  if locked is null then
    raise exception 'FAIL: locked_at was not set when the inspection was signed';
  end if;
  raise notice 'ok: locked_at set on signing';
end;
$$;

-- ---------------------------------------------------------------------------
-- After locking, the inspection content is frozen (3.16).
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update room_elements set description = 'Achteraf gewijzigd'
     where id = '77777777-7777-4777-8777-777777777777';
    raise exception 'FAIL: a locked inspection accepted an element change';
  exception when check_violation then
    raise notice 'ok: write to a locked inspection rejected';
  end;
end;
$$;

-- A signature is never changed or removed (3.11).
do $$
begin
  begin
    update signatures set party_remarks = 'Achteraf toegevoegd'
     where party_id = '88888888-8888-4888-8888-888888888888';
    raise exception 'FAIL: a signature was updated';
  exception when check_violation then
    raise notice 'ok: signature update rejected';
  end;

  begin
    delete from signatures where party_id = '88888888-8888-4888-8888-888888888888';
    raise exception 'FAIL: a signature was deleted';
  exception when check_violation then
    raise notice 'ok: signature delete rejected';
  end;
end;
$$;

-- A signer who disagrees must leave remarks (3.11).
do $$
begin
  begin
    insert into signatures (inspection_id, party_id, signature_image_path, signature_sha256,
                            agrees_with_report, signed_at, device_id, app_version, report_snapshot_sha256)
    values ('55555555-5555-4555-8555-555555555555', '88888888-8888-4888-8888-888888888888',
            'local/sig2.png', 'beef', false, now(), 'device-a', '0.1.0', 'cafe');
    raise exception 'FAIL: disagreement accepted without remarks';
  exception when check_violation then
    raise notice 'ok: disagreement requires remarks';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention stays inside the agreed band (3.1).
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update organizations set retention_years = 30 where id = '22222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: retention_years accepted outside 3-15';
  exception when check_violation then
    raise notice 'ok: retention_years constrained to 3-15';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- The audit log filled itself (3.17).
-- ---------------------------------------------------------------------------
do $$
declare
  status_changes integer;
begin
  select count(*) into status_changes
    from audit_log
   where entity_type = 'inspections'
     and entity_id = '55555555-5555-4555-8555-555555555555'
     and action = 'status_change';

  if status_changes < 3 then
    raise exception 'FAIL: expected several logged status changes, found %', status_changes;
  end if;
  raise notice 'ok: audit log recorded % status changes', status_changes;
end;
$$;

rollback;
