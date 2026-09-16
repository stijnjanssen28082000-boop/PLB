-- Multi-tenancy (docs/datamodel.md §2): a user only ever sees rows belonging to
-- their own organization. RLS is on for every table that holds customer data.
--
-- Exception: room_templates with organization_id = NULL are the global starter
-- kit — readable by everyone, editable by no customer.

-- Helper functions are security definer so a policy can read `users` without
-- recursing into that table's own policy.
create or replace function current_app_user_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from users
   where auth_user_id = auth.uid() and is_active and deleted_at is null;
$$;

create or replace function current_app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from users
   where auth_user_id = auth.uid() and is_active and deleted_at is null;
$$;

-- Does the given inspection belong to the caller's organization?
create or replace function owns_inspection(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from inspections i
     where i.id = target and i.organization_id = current_app_user_org()
  );
$$;

create or replace function owns_room(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from rooms r
     where r.id = target and owns_inspection(r.inspection_id)
  );
$$;

create or replace function owns_report(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from reports rp
     where rp.id = target and rp.organization_id = current_app_user_org()
  );
$$;

alter table organizations        enable row level security;
alter table users                enable row level security;
alter table user_invitations     enable row level security;
alter table properties           enable row level security;
alter table room_templates       enable row level security;
alter table inspections          enable row level security;
alter table rooms                enable row level security;
alter table room_elements        enable row level security;
alter table photos               enable row level security;
alter table meter_readings       enable row level security;
alter table keys                 enable row level security;
alter table inspection_parties   enable row level security;
alter table signatures           enable row level security;
alter table ai_suggestions       enable row level security;
alter table reports              enable row level security;
alter table mail_log             enable row level security;
alter table report_party_access  enable row level security;
alter table report_comments      enable row level security;
alter table device_sync_sessions enable row level security;
alter table audit_log            enable row level security;

-- --- organizations ---------------------------------------------------------
create policy organizations_select on organizations
  for select using (id = current_app_user_org());

-- Only an admin edits organization settings (Flow F.4).
create policy organizations_update on organizations
  for update using (id = current_app_user_org() and current_app_user_role() = 'admin')
  with check (id = current_app_user_org());

-- --- users -----------------------------------------------------------------
create policy users_select on users
  for select using (organization_id = current_app_user_org());

create policy users_admin_write on users
  for all using (organization_id = current_app_user_org() and current_app_user_role() = 'admin')
  with check (organization_id = current_app_user_org());

-- --- user_invitations (Flow F.3, admin only) -------------------------------
create policy user_invitations_admin on user_invitations
  for all using (organization_id = current_app_user_org() and current_app_user_role() = 'admin')
  with check (organization_id = current_app_user_org());

-- --- properties ------------------------------------------------------------
create policy properties_select on properties
  for select using (organization_id = current_app_user_org());

create policy properties_write on properties
  for all using (
    organization_id = current_app_user_org()
    and current_app_user_role() in ('admin', 'dispatcher', 'plaatsbeschrijver')
  )
  with check (organization_id = current_app_user_org());

-- --- room_templates --------------------------------------------------------
-- Global starter kit is readable by everyone; only an admin edits their own.
create policy room_templates_select on room_templates
  for select using (organization_id is null or organization_id = current_app_user_org());

create policy room_templates_admin_write on room_templates
  for all using (organization_id = current_app_user_org() and current_app_user_role() = 'admin')
  with check (organization_id = current_app_user_org());

-- --- inspections -----------------------------------------------------------
create policy inspections_select on inspections
  for select using (organization_id = current_app_user_org());

create policy inspections_write on inspections
  for all using (
    organization_id = current_app_user_org()
    and current_app_user_role() in ('admin', 'dispatcher', 'plaatsbeschrijver')
  )
  with check (organization_id = current_app_user_org());

-- --- inspection children ---------------------------------------------------
create policy rooms_all on rooms
  for all using (owns_inspection(inspection_id)) with check (owns_inspection(inspection_id));

create policy room_elements_all on room_elements
  for all using (owns_room(room_id)) with check (owns_room(room_id));

create policy photos_all on photos
  for all using (organization_id = current_app_user_org())
  with check (organization_id = current_app_user_org());

create policy meter_readings_all on meter_readings
  for all using (owns_inspection(inspection_id)) with check (owns_inspection(inspection_id));

create policy keys_all on keys
  for all using (owns_inspection(inspection_id)) with check (owns_inspection(inspection_id));

create policy inspection_parties_all on inspection_parties
  for all using (owns_inspection(inspection_id)) with check (owns_inspection(inspection_id));

-- Signatures are insert + select only; the immutability trigger blocks the rest.
create policy signatures_select on signatures
  for select using (owns_inspection(inspection_id));

create policy signatures_insert on signatures
  for insert with check (owns_inspection(inspection_id));

create policy ai_suggestions_select on ai_suggestions
  for select using (owns_inspection(inspection_id));

-- Review decisions are a user action; the rows themselves are written by an
-- edge function with the service role (§6.9).
create policy ai_suggestions_update on ai_suggestions
  for update using (owns_inspection(inspection_id)) with check (owns_inspection(inspection_id));

-- --- reports and delivery --------------------------------------------------
create policy reports_select on reports
  for select using (organization_id = current_app_user_org());

create policy mail_log_select on mail_log
  for select using (owns_report(report_id));

create policy report_party_access_select on report_party_access
  for select using (owns_report(report_id));

-- Flow F.6: the backoffice reads and resolves party comments. The comments
-- themselves arrive through the public Flow G endpoint, which runs with the
-- service role after validating the token — never through this policy.
create policy report_comments_select on report_comments
  for select using (owns_report(report_id));

create policy report_comments_resolve on report_comments
  for update using (
    owns_report(report_id) and current_app_user_role() in ('admin', 'dispatcher')
  )
  with check (owns_report(report_id));

create policy device_sync_sessions_all on device_sync_sessions
  for all using (owns_inspection(inspection_id)) with check (owns_inspection(inspection_id));

-- --- audit_log -------------------------------------------------------------
-- Readable by an admin for their own organization, never writable from the app:
-- the triggers write it with the definer's rights.
create policy audit_log_admin_select on audit_log
  for select using (organization_id = current_app_user_org() and current_app_user_role() = 'admin');
