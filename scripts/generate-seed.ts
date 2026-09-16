/**
 * Generates supabase/seed.sql from the starter kit in src/domain/templates.
 *
 * The TypeScript definition is the source of truth: the app needs the same
 * templates offline on first run, and defining 20 room types twice is how the
 * two copies drift apart.
 *
 * Run with: npx tsx scripts/generate-seed.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOBAL_ROOM_TEMPLATES } from '../src/domain/templates/starterKit';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../supabase/seed.sql');

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const rows = GLOBAL_ROOM_TEMPLATES.map((template) =>
  [
    sqlString(template.id),
    'null',
    sqlString(template.country),
    sqlString(template.room_type),
    `${sqlString(JSON.stringify(template.name_translations))}::jsonb`,
    String(template.version),
    String(template.is_active),
    `${sqlString(JSON.stringify(template.elements))}::jsonb`,
    String(template.sort_order),
  ].join(', '),
).map((values) => `  (${values})`);

const sql = `-- GENERATED FILE — do not edit by hand.
-- Source: src/domain/templates/starterKit.ts
-- Regenerate with: npx tsx scripts/generate-seed.ts
--
-- The global starter kit (docs/datamodel.md 3.5d): organization_id = NULL means
-- readable by every organization, editable by none. Customers duplicate a row
-- into their own organization to change it.

insert into room_templates
  (id, organization_id, country, room_type, name_translations, version, is_active, elements, sort_order)
values
${rows.join(',\n')}
on conflict (id) do update set
  name_translations = excluded.name_translations,
  elements          = excluded.elements,
  sort_order        = excluded.sort_order,
  updated_at        = now();
`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, sql, 'utf8');
console.log(`Wrote ${GLOBAL_ROOM_TEMPLATES.length} room templates to ${target}`);
