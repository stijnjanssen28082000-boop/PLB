import { toSqlJson, type SqlDriver } from '@/data/db/driver';
import { upsertRow, type WriteContext } from '@/data/repositories/persist';
import { GLOBAL_ROOM_TEMPLATES } from '@/domain/templates/starterKit';

/**
 * Local development data, so Flow B can be built and tested on its own before
 * Flow A exists (docs/ux.md §5: build Flow B first and separately testable).
 *
 * Only ever runs against the local SQLite database on a developer's machine —
 * it writes no server rows and is not reachable from a production build.
 */

const ORGANIZATION_ID = '00000000-0000-4000-9000-000000000001';
const USER_ID = '00000000-0000-4000-9000-000000000002';
const PROPERTY_ID = '00000000-0000-4000-9000-000000000003';
const INSPECTION_ID = '00000000-0000-4000-9000-000000000004';

export async function ensureDevInspection(
  db: SqlDriver,
  context: WriteContext,
): Promise<string> {
  const [existing] = await db.query('select id from inspections where id = ?', [INSPECTION_ID]);
  if (existing) return INSPECTION_ID;

  await seedRoomTemplates(db);

  await upsertRow(
    db,
    'organizations',
    {
      id: ORGANIZATION_ID,
      name: 'Demo Inspecties',
      country: 'BE',
      default_language: 'nl',
    },
    context,
  );

  await upsertRow(
    db,
    'users',
    {
      id: USER_ID,
      auth_user_id: USER_ID,
      organization_id: ORGANIZATION_ID,
      full_name: 'Demo Plaatsbeschrijver',
      email: 'demo@voorbeeld.be',
      role: 'plaatsbeschrijver',
      language: 'nl',
      is_active: 1,
    },
    context,
  );

  await upsertRow(
    db,
    'properties',
    {
      id: PROPERTY_ID,
      organization_id: ORGANIZATION_ID,
      street: 'Demostraat',
      house_number: '12',
      postal_code: '2000',
      city: 'Antwerpen',
      country: 'BE',
      region: 'vlaanderen',
      property_type: 'apartment',
    },
    context,
  );

  await upsertRow(
    db,
    'inspections',
    {
      id: INSPECTION_ID,
      organization_id: ORGANIZATION_ID,
      property_id: PROPERTY_ID,
      type: 'entry',
      status: 'in_progress',
      inspector_user_id: USER_ID,
      language: 'nl',
      device_id: context.deviceId,
      // 3.5d: the street side is the north wall by convention, recorded once
      // per inspection.
      street_side_facade: 'north',
      started_at: new Date().toISOString(),
    },
    context,
  );

  return INSPECTION_ID;
}

/**
 * On a real device the starter kit arrives as a read-only download during sync.
 * In development it is written straight from the TypeScript definition, which is
 * the same source the server seed is generated from.
 */
async function seedRoomTemplates(db: SqlDriver): Promise<void> {
  const timestamp = new Date().toISOString();

  for (const template of GLOBAL_ROOM_TEMPLATES) {
    await db.execute(
      `insert or replace into room_templates
         (id, organization_id, country, room_type, name_translations, version, is_active,
          elements, sort_order, created_at, updated_at)
       values (?, null, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        template.id,
        template.country,
        template.room_type,
        toSqlJson(template.name_translations),
        template.version,
        toSqlJson(template.elements),
        template.sort_order,
        timestamp,
        timestamp,
      ],
    );
  }
}
