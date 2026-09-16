-- Plaatsbeschrijving-app — initial schema
-- Implements docs/datamodel.md (Deel B). Conventions from that document:
--   * every table has id (uuid v4, generated on the device), created_at, updated_at
--   * all timestamps UTC
--   * enums stored as text, never a Postgres ENUM type, so local SQLite and the
--     server stay identical
--   * soft delete via deleted_at — nothing is ever physically removed

-- Defaults exist only as a safety net for rows created server-side (seeds,
-- backoffice). The app always supplies its own id: see docs/datamodel.md §6.1.
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 3.1 organizations
-- ---------------------------------------------------------------------------
create table organizations (
  id                          uuid primary key default gen_random_uuid(),
  name                        text        not null,
  vat_number                  text,
  country                     text        not null check (country in ('BE', 'FR')),
  default_language            text        not null check (default_language in ('nl', 'fr', 'en')),
  -- [v6] Stored and shown in the Flow F.4 preview from v1, but only actually
  -- rendered into the PDF/mail headers once white-label ships in v2.
  logo_url                    text,
  report_sender_name          text,
  report_sender_email         text,
  report_sender_email_status  text        not null default 'unverified'
                                          check (report_sender_email_status in ('unverified', 'verifying', 'verified')),
  -- [v6] Not white-label, just a text block — active from v1.
  mail_signature_translations jsonb       not null default '{}'::jsonb,
  -- [v5] Customer's own intro, placed next to the legal text, never instead of it.
  custom_intro_translations   jsonb       not null default '{}'::jsonb,
  retention_years             integer     not null default 10 check (retention_years between 3 and 15),
  comment_window_days         integer     not null default 14 check (comment_window_days between 7 and 30),
  plan                        text        not null default 'pilot' check (plan in ('pilot', 'starter', 'pro')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);

-- ---------------------------------------------------------------------------
-- 3.2 users
-- ---------------------------------------------------------------------------
create table users (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid        not null unique references auth.users (id) on delete cascade,
  organization_id uuid        not null references organizations (id),
  full_name       text        not null,
  email           text        not null,
  role            text        not null check (role in ('admin', 'dispatcher', 'plaatsbeschrijver', 'viewer')),
  language        text        not null check (language in ('nl', 'fr', 'en')),
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index users_organization_idx on users (organization_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3.2b user_invitations
-- ---------------------------------------------------------------------------
create table user_invitations (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid        not null references organizations (id),
  email              text        not null,
  role               text        not null check (role in ('admin', 'dispatcher', 'plaatsbeschrijver', 'viewer')),
  invited_by_user_id uuid        not null references users (id),
  token              text        not null unique,
  status             text        not null default 'pending'
                                 check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at         timestamptz not null default (now() + interval '7 days'),
  accepted_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index user_invitations_org_status_idx on user_invitations (organization_id, status);

-- ---------------------------------------------------------------------------
-- 3.3 properties
-- ---------------------------------------------------------------------------
create table properties (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid        not null references organizations (id),
  external_reference text,
  street             text        not null,
  house_number       text        not null,
  box                text,
  postal_code        text        not null,
  city               text        not null,
  country            text        not null check (country in ('BE', 'FR')),
  -- [v4] Each Belgian region has its own rental legislation, which decides the
  -- legal introduction in the report (3.5c). Required when country = BE.
  region             text        check (region in ('vlaanderen', 'brussel', 'wallonie')),
  property_type      text        not null
                                 check (property_type in ('apartment', 'house', 'studio', 'commercial', 'garage', 'other')),
  floor              text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint properties_region_required_for_be check (country <> 'BE' or region is not null)
);

create index properties_search_idx on properties (organization_id, postal_code, street);

-- ---------------------------------------------------------------------------
-- 3.5 room_templates  (organization_id NULL = global starter kit)
-- ---------------------------------------------------------------------------
create table room_templates (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid        references organizations (id),
  country            text        not null check (country in ('BE', 'FR', 'ALL')),
  -- [v5] Free slug, deliberately not a closed enum: an organization must be able
  -- to add a room type of its own (see docs/datamodel.md 3.5d).
  room_type          text        not null,
  name_translations  jsonb       not null,
  version            integer     not null default 1 check (version >= 1),
  is_active          boolean     not null default true,
  elements           jsonb       not null,
  sort_order         integer     not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index room_templates_lookup_idx on room_templates (organization_id, country, is_active);

-- ---------------------------------------------------------------------------
-- 3.4 inspections
-- ---------------------------------------------------------------------------
create table inspections (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid        not null references organizations (id),
  property_id           uuid        not null references properties (id),
  type                  text        not null check (type in ('entry', 'exit', 'interim')),
  linked_inspection_id  uuid        references inspections (id),
  status                text        not null default 'draft'
                                    check (status in ('draft', 'in_progress', 'awaiting_signatures', 'signed',
                                                      'pending_sync', 'synced', 'ai_processing', 'review',
                                                      'approved', 'sent', 'archived')),
  inspector_user_id     uuid        not null references users (id),
  scheduled_at          timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  -- Set when all required parties have signed. From here on rooms/elements/photos
  -- are immutable (enforced by inspection_is_locked() below).
  locked_at             timestamptz,
  language              text        not null check (language in ('nl', 'fr', 'en')),
  template_set_version  integer     not null default 1,
  general_notes         text,
  weather_conditions    text,
  is_furnished          boolean,
  lease_contract_date   date,
  lease_start_date      date,
  -- [v4] By convention the street side is called the north wall, whatever the
  -- actual compass direction. Recorded once per inspection (3.5d).
  street_side_facade    text        check (street_side_facade in ('north', 'east', 'south', 'west')),
  device_id             text        not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create index inspections_org_status_idx on inspections (organization_id, status) where deleted_at is null;
create index inspections_inspector_idx on inspections (inspector_user_id, scheduled_at) where deleted_at is null;
create index inspections_linked_idx on inspections (linked_inspection_id);

-- ---------------------------------------------------------------------------
-- 3.6 rooms
-- ---------------------------------------------------------------------------
create table rooms (
  id                    uuid primary key default gen_random_uuid(),
  inspection_id         uuid        not null references inspections (id),
  room_template_id      uuid        not null references room_templates (id),
  room_template_version integer     not null,
  name                  text        not null,
  sort_order            integer     not null default 0,
  floor_level           text,
  is_completed          boolean     not null default false,
  general_notes         text,
  linked_room_id        uuid        references rooms (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create index rooms_inspection_idx on rooms (inspection_id, sort_order) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3.7 room_elements
-- ---------------------------------------------------------------------------
create table room_elements (
  id                        uuid primary key default gen_random_uuid(),
  room_id                   uuid        not null references rooms (id),
  element_key               text        not null,
  condition                 text        check (condition in ('good', 'traces_of_use', 'damaged',
                                                             'not_applicable', 'not_inspected')),
  description               text,
  description_source        text        check (description_source in ('manual', 'default', 'ai_accepted', 'ai_edited')),
  sub_attribute_values      jsonb       not null default '{}'::jsonb,
  linked_element_id         uuid        references room_elements (id),
  has_change_vs_linked      boolean,
  change_description        text,
  -- Legally the most important field in the app. Filled in by a human, never by AI.
  liability                 text        check (liability in ('tenant', 'landlord', 'normal_wear', 'undetermined')),
  sort_order                integer     not null default 0,
  device_id                 text        not null,
  -- Device clock, deliberately separate from updated_at (server clock): this is
  -- the basis for conflict detection.
  client_updated_at         timestamptz not null,
  sync_conflict_status      text        not null default 'none'
                                        check (sync_conflict_status in ('none', 'pending_review', 'resolved')),
  conflicting_payload       jsonb,
  conflict_resolved_by_user_id uuid     references users (id),
  conflict_resolved_at      timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  constraint room_elements_room_key_unique unique (room_id, element_key)
);

create index room_elements_room_idx on room_elements (room_id, sort_order) where deleted_at is null;
create index room_elements_conflict_idx on room_elements (sync_conflict_status)
  where sync_conflict_status = 'pending_review';

-- ---------------------------------------------------------------------------
-- 3.8 photos
-- ---------------------------------------------------------------------------
create table photos (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid        not null references organizations (id),
  inspection_id          uuid        not null references inspections (id),
  room_id                uuid        references rooms (id),
  room_element_id        uuid        references room_elements (id),
  meter_reading_id       uuid,
  local_path             text,
  storage_path           text,
  thumbnail_storage_path text,
  file_size_bytes        integer,
  width                  integer,
  height                 integer,
  mime_type              text        not null default 'image/jpeg',
  sha256                 text        not null,
  taken_at               timestamptz not null,
  gps_lat                numeric,
  gps_lng                numeric,
  caption                text,
  sort_order             integer     not null default 0,
  -- [v4] Continuous numbering across the whole inspection, assigned at report
  -- generation — not when the photo is taken (the inspector is offline and does
  -- not yet know the total).
  photo_number           integer,
  upload_status          text        not null default 'pending'
                                     check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  upload_attempts        integer     not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

create index photos_element_idx on photos (room_element_id, sort_order) where deleted_at is null;
create index photos_inspection_idx on photos (inspection_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3.12 meter_readings
-- ---------------------------------------------------------------------------
create table meter_readings (
  id                   uuid primary key default gen_random_uuid(),
  inspection_id        uuid        not null references inspections (id),
  meter_type           text        not null
                       check (meter_type in ('electricity_day', 'electricity_night', 'electricity_exclusive_night',
                                             'electricity_injection_day', 'electricity_injection_night',
                                             'gas', 'water', 'heating_calorimeter', 'other')),
  meter_number         text,
  ean_code             text,
  reading_value        numeric     not null,
  unit                 text        not null check (unit in ('kWh', 'm3', 'other')),
  location_description text,
  sort_order           integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index meter_readings_inspection_idx on meter_readings (inspection_id, sort_order) where deleted_at is null;

alter table photos
  add constraint photos_meter_reading_fk foreign key (meter_reading_id) references meter_readings (id);

-- ---------------------------------------------------------------------------
-- 3.13 keys
-- ---------------------------------------------------------------------------
create table keys (
  id                 uuid primary key default gen_random_uuid(),
  inspection_id      uuid        not null references inspections (id),
  key_type           text        not null
                     check (key_type in ('front_door', 'interior_doors', 'mailbox', 'garage',
                                         'cellar', 'badge', 'remote', 'other')),
  quantity           integer     not null check (quantity >= 0),
  -- [v4] The report then states the reservation explicitly instead of a hard number.
  quantity_uncertain boolean     not null default false,
  description        text,
  handed_over        boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index keys_inspection_idx on keys (inspection_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3.10 inspection_parties
-- ---------------------------------------------------------------------------
create table inspection_parties (
  id              uuid primary key default gen_random_uuid(),
  inspection_id   uuid        not null references inspections (id),
  party_type      text        not null
                  check (party_type in ('tenant', 'landlord', 'landlord_representative',
                                        'tenant_representative', 'agent', 'plaatsbeschrijver')),
  full_name       text        not null,
  email           text,
  phone           text,
  company_name    text,
  is_present      boolean     not null default true,
  must_sign       boolean     not null default true,
  receives_report boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- A party that must receive the report needs somewhere to send it.
  constraint inspection_parties_email_for_report check (not receives_report or email is not null)
);

create index inspection_parties_inspection_idx on inspection_parties (inspection_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3.11 signatures — never updated, never deleted
-- ---------------------------------------------------------------------------
create table signatures (
  id                     uuid primary key default gen_random_uuid(),
  inspection_id          uuid        not null references inspections (id),
  party_id               uuid        not null references inspection_parties (id),
  signature_image_path   text        not null,
  signature_sha256       text        not null,
  party_remarks          text,
  agrees_with_report     boolean     not null,
  signed_at              timestamptz not null,
  device_id              text        not null,
  ip_address             text,
  app_version            text        not null,
  -- Hash of the inspection data at the moment of signing: proves what was signed.
  report_snapshot_sha256 text        not null,
  created_at             timestamptz not null default now(),
  constraint signatures_remarks_required_on_disagreement
    check (agrees_with_report or party_remarks is not null)
);

create unique index signatures_party_unique on signatures (party_id);

-- ---------------------------------------------------------------------------
-- 3.9 ai_suggestions — schema exists from v1, stays empty until v1.x
-- ---------------------------------------------------------------------------
create table ai_suggestions (
  id                 uuid primary key default gen_random_uuid(),
  inspection_id      uuid        not null references inspections (id),
  room_element_id    uuid        references room_elements (id),
  photo_id           uuid        references photos (id),
  suggestion_type    text        not null
                     check (suggestion_type in ('photo_description', 'change_detection', 'report_summary')),
  model              text        not null,
  prompt_version     text        not null,
  input_summary      jsonb,
  output             jsonb       not null,
  confidence         text        check (confidence in ('high', 'medium', 'low')),
  status             text        not null default 'pending'
                     check (status in ('pending', 'accepted', 'edited', 'rejected')),
  reviewed_by_user_id uuid       references users (id),
  reviewed_at        timestamptz,
  cost_input_tokens  integer,
  cost_output_tokens integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index ai_suggestions_inspection_idx on ai_suggestions (inspection_id, status);

-- ---------------------------------------------------------------------------
-- 3.14 reports
-- ---------------------------------------------------------------------------
create table reports (
  id                     uuid primary key default gen_random_uuid(),
  inspection_id          uuid        not null references inspections (id),
  organization_id        uuid        not null references organizations (id),
  version                integer     not null default 1,
  pdf_storage_path       text        not null,
  pdf_sha256             text        not null,
  generated_at           timestamptz not null default now(),
  generated_by_user_id   uuid        not null references users (id),
  language               text        not null check (language in ('nl', 'fr', 'en')),
  includes_ai_summary    boolean     not null default false,
  addendum_text          text,
  -- [v2] Proves not only that the data is unchanged but when it existed.
  rfc3161_timestamp_token bytea,
  rfc3161_authority      text,
  rfc3161_timestamped_at timestamptz,
  created_at             timestamptz not null default now(),
  constraint reports_inspection_version_unique unique (inspection_id, version)
);

create index reports_inspection_idx on reports (inspection_id);

-- ---------------------------------------------------------------------------
-- 3.15 mail_log
-- ---------------------------------------------------------------------------
create table mail_log (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid        not null references reports (id),
  party_id            uuid        not null references inspection_parties (id),
  recipient_email     text        not null,
  template_key        text        not null,
  provider_message_id text,
  status              text        not null default 'queued'
                      check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  sent_at             timestamptz,
  delivered_at        timestamptz,
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index mail_log_report_idx on mail_log (report_id);

-- ---------------------------------------------------------------------------
-- 3.15b report_party_access — token access for parties without an account
-- ---------------------------------------------------------------------------
create table report_party_access (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid        not null references reports (id),
  party_id         uuid        not null references inspection_parties (id),
  token            text        not null unique,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now(),
  last_accessed_at timestamptz,
  access_count     integer     not null default 0
);

-- ---------------------------------------------------------------------------
-- 3.15c report_comments — additive layer, never touches the locked inspection
-- ---------------------------------------------------------------------------
create table report_comments (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid        not null references reports (id),
  party_id            uuid        not null references inspection_parties (id),
  room_element_id     uuid        references room_elements (id),
  photo_id            uuid        references photos (id),
  comment_text        text        not null,
  status              text        not null default 'open'
                      check (status in ('open', 'acknowledged', 'resolved')),
  resolved_by_user_id uuid        references users (id),
  resolved_at         timestamptz,
  resolution_note     text,
  ip_address          text,
  created_at          timestamptz not null default now()
);

create index report_comments_status_idx on report_comments (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3.16b device_sync_sessions — diagnostic only, no business logic depends on it
-- ---------------------------------------------------------------------------
create table device_sync_sessions (
  id                 uuid primary key default gen_random_uuid(),
  inspection_id      uuid        not null references inspections (id),
  device_id          text        not null,
  user_id            uuid        not null references users (id),
  sync_started_at    timestamptz not null default now(),
  sync_completed_at  timestamptz,
  rows_synced        integer,
  photos_synced      integer,
  conflicts_detected integer     not null default 0,
  app_version        text        not null,
  created_at         timestamptz not null default now()
);

create index device_sync_sessions_inspection_idx on device_sync_sessions (inspection_id, sync_started_at desc);

-- ---------------------------------------------------------------------------
-- 3.17 audit_log — filled by triggers, never written by the app
-- ---------------------------------------------------------------------------
create table audit_log (
  id              bigserial primary key,
  organization_id uuid,
  user_id         uuid,
  entity_type     text        not null,
  entity_id       text        not null,
  action          text        not null
                  check (action in ('create', 'update', 'delete', 'status_change', 'lock', 'approve', 'send')),
  before          jsonb,
  after           jsonb,
  device_id       text,
  ip_address      text,
  created_at      timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);
create index audit_log_org_idx on audit_log (organization_id, created_at desc);
