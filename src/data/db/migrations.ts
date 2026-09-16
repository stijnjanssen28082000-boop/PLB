import type { SqlDriver } from './driver';

/**
 * Local SQLite schema, mirroring supabase/migrations (docs/datamodel.md §6.10:
 * every schema change ships as a Postgres migration *and* a mirroring SQLite
 * migration, tracked in a local schema_version table).
 *
 * Differences from the server, all deliberate:
 *   - booleans are integers, json is text, timestamps are ISO-8601 text
 *   - no RLS: the device only ever holds one organization's data
 *   - sync_queue exists only here; audit_log, mail_log and reports only there
 *     (docs/datamodel.md §4)
 */

export interface LocalMigration {
  version: number;
  name: string;
  statements: string[];
}

export const LOCAL_MIGRATIONS: LocalMigration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `create table organizations (
        id text primary key,
        name text not null,
        vat_number text,
        country text not null,
        default_language text not null,
        logo_url text,
        report_sender_name text,
        report_sender_email text,
        mail_signature_translations text not null default '{}',
        custom_intro_translations text not null default '{}',
        retention_years integer not null default 10,
        comment_window_days integer not null default 14,
        plan text not null default 'pilot',
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create table users (
        id text primary key,
        auth_user_id text not null,
        organization_id text not null,
        full_name text not null,
        email text not null,
        role text not null,
        language text not null,
        is_active integer not null default 1,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create table properties (
        id text primary key,
        organization_id text not null,
        external_reference text,
        street text not null,
        house_number text not null,
        box text,
        postal_code text not null,
        city text not null,
        country text not null,
        region text,
        property_type text not null,
        floor text,
        notes text,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create index properties_search_idx on properties (organization_id, postal_code, street)`,

      `create table room_templates (
        id text primary key,
        organization_id text,
        country text not null,
        room_type text not null,
        name_translations text not null,
        version integer not null default 1,
        is_active integer not null default 1,
        elements text not null,
        sort_order integer not null default 0,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create table inspections (
        id text primary key,
        organization_id text not null,
        property_id text not null,
        type text not null check (type in ('entry', 'exit', 'interim')),
        linked_inspection_id text,
        status text not null default 'draft',
        inspector_user_id text not null,
        scheduled_at text,
        started_at text,
        completed_at text,
        locked_at text,
        language text not null,
        template_set_version integer not null default 1,
        general_notes text,
        weather_conditions text,
        is_furnished integer,
        lease_contract_date text,
        lease_start_date text,
        street_side_facade text,
        device_id text not null,
        created_at text not null,
        updated_at text not null,
        deleted_at text,
        foreign key (property_id) references properties (id)
      )`,

      `create index inspections_status_idx on inspections (status, scheduled_at)`,

      `create table rooms (
        id text primary key,
        inspection_id text not null,
        room_template_id text not null,
        room_template_version integer not null,
        name text not null,
        sort_order integer not null default 0,
        floor_level text,
        is_completed integer not null default 0,
        general_notes text,
        linked_room_id text,
        created_at text not null,
        updated_at text not null,
        deleted_at text,
        foreign key (inspection_id) references inspections (id)
      )`,

      `create index rooms_inspection_idx on rooms (inspection_id, sort_order)`,

      `create table room_elements (
        id text primary key,
        room_id text not null,
        element_key text not null,
        condition text,
        description text,
        description_source text,
        sub_attribute_values text not null default '{}',
        linked_element_id text,
        has_change_vs_linked integer,
        change_description text,
        liability text,
        sort_order integer not null default 0,
        device_id text not null,
        client_updated_at text not null,
        sync_conflict_status text not null default 'none',
        conflicting_payload text,
        conflict_resolved_by_user_id text,
        conflict_resolved_at text,
        created_at text not null,
        updated_at text not null,
        deleted_at text,
        unique (room_id, element_key),
        foreign key (room_id) references rooms (id)
      )`,

      `create index room_elements_room_idx on room_elements (room_id, sort_order)`,

      `create table photos (
        id text primary key,
        organization_id text not null,
        inspection_id text not null,
        room_id text,
        room_element_id text,
        meter_reading_id text,
        local_path text,
        storage_path text,
        thumbnail_storage_path text,
        file_size_bytes integer,
        width integer,
        height integer,
        mime_type text not null default 'image/jpeg',
        sha256 text not null,
        taken_at text not null,
        gps_lat real,
        gps_lng real,
        caption text,
        sort_order integer not null default 0,
        photo_number integer,
        upload_status text not null default 'pending',
        upload_attempts integer not null default 0,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create index photos_element_idx on photos (room_element_id, sort_order)`,
      `create index photos_inspection_idx on photos (inspection_id)`,

      `create table meter_readings (
        id text primary key,
        inspection_id text not null,
        meter_type text not null,
        meter_number text,
        ean_code text,
        reading_value real not null,
        unit text not null,
        location_description text,
        sort_order integer not null default 0,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create table keys (
        id text primary key,
        inspection_id text not null,
        key_type text not null,
        quantity integer not null,
        quantity_uncertain integer not null default 0,
        description text,
        handed_over integer not null default 0,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create table inspection_parties (
        id text primary key,
        inspection_id text not null,
        party_type text not null,
        full_name text not null,
        email text,
        phone text,
        company_name text,
        is_present integer not null default 1,
        must_sign integer not null default 1,
        receives_report integer not null default 1,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,

      `create table signatures (
        id text primary key,
        inspection_id text not null,
        party_id text not null unique,
        signature_image_path text not null,
        signature_sha256 text not null,
        party_remarks text,
        agrees_with_report integer not null,
        signed_at text not null,
        device_id text not null,
        ip_address text,
        app_version text not null,
        report_snapshot_sha256 text not null,
        created_at text not null
      )`,

      `create table ai_suggestions (
        id text primary key,
        inspection_id text not null,
        room_element_id text,
        photo_id text,
        suggestion_type text not null,
        model text not null,
        prompt_version text not null,
        input_summary text,
        output text not null,
        confidence text,
        status text not null default 'pending',
        reviewed_by_user_id text,
        reviewed_at text,
        cost_input_tokens integer,
        cost_output_tokens integer,
        created_at text not null,
        updated_at text not null
      )`,

      // Local only (docs/datamodel.md 3.16). id is autoincrement because the
      // order the rows were written in is the order they must be replayed in.
      `create table sync_queue (
        id integer primary key autoincrement,
        entity_type text not null,
        entity_id text not null,
        operation text not null check (operation in ('upsert', 'soft_delete', 'upload_file')),
        payload text,
        file_local_path text,
        device_id text not null,
        client_updated_at text not null,
        attempts integer not null default 0,
        last_error text,
        status text not null default 'pending'
          check (status in ('pending', 'in_progress', 'done', 'failed')),
        created_at text not null
      )`,

      `create index sync_queue_pending_idx on sync_queue (status, id)`,
    ],
  },
];

const SCHEMA_VERSION_TABLE = `create table if not exists schema_version (
  version    integer primary key,
  name       text not null,
  applied_at text not null
)`;

/** Applies any local migration this device has not run yet. */
export async function migrateLocalDatabase(db: SqlDriver): Promise<number> {
  await db.execute(SCHEMA_VERSION_TABLE);

  const applied = await db.query<{ version: number }>('select version from schema_version');
  const appliedVersions = new Set(applied.map((row) => row.version));

  let lastVersion = 0;
  for (const migration of LOCAL_MIGRATIONS) {
    lastVersion = Math.max(lastVersion, migration.version);
    if (appliedVersions.has(migration.version)) continue;

    await db.transaction(async (tx) => {
      for (const statement of migration.statements) {
        await tx.execute(statement);
      }
      await tx.execute('insert into schema_version (version, name, applied_at) values (?, ?, ?)', [
        migration.version,
        migration.name,
        new Date().toISOString(),
      ]);
    });
  }

  return lastVersion;
}
