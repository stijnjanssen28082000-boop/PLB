import { fromSqlBool, fromSqlJson, toSqlBool, toSqlJson, type SqlDriver } from '@/data/db/driver';
import { transitionInspectionStatus } from '@/domain/inspectionStatus';
import {
  translate,
  type ElementCondition,
  type ElementDefinition,
  type Inspection,
  type InspectionStatus,
  type Language,
  type Room,
  type RoomElement,
  type RoomTemplate,
} from '@/domain/types';
import { upsertRow, utcNow, type WriteContext } from './persist';

/**
 * Reads and writes for the inspector flows (A–E). Components never touch SQL;
 * they go through here (docs/datamodel.md §6.2).
 */

const ACTIVE = 'deleted_at is null';

export async function getInspection(db: SqlDriver, id: string): Promise<Inspection | null> {
  const [row] = await db.query(`select * from inspections where id = ? and ${ACTIVE}`, [id]);
  return row ? mapInspection(row) : null;
}

export async function listRooms(db: SqlDriver, inspectionId: string): Promise<Room[]> {
  const rows = await db.query(
    `select * from rooms where inspection_id = ? and ${ACTIVE} order by sort_order`,
    [inspectionId],
  );
  return rows.map(mapRoom);
}

export async function listRoomElements(db: SqlDriver, roomId: string): Promise<RoomElement[]> {
  const rows = await db.query(
    `select * from room_elements where room_id = ? and ${ACTIVE} order by sort_order`,
    [roomId],
  );
  return rows.map(mapRoomElement);
}

export async function getRoomTemplate(db: SqlDriver, id: string): Promise<RoomTemplate | null> {
  const [row] = await db.query(`select * from room_templates where id = ? and ${ACTIVE}`, [id]);
  return row ? mapRoomTemplate(row) : null;
}

export async function listRoomTemplates(
  db: SqlDriver,
  organizationId: string,
): Promise<RoomTemplate[]> {
  // The organization's own templates plus the global starter kit.
  const rows = await db.query(
    `select * from room_templates
      where (organization_id = ? or organization_id is null)
        and is_active = 1 and ${ACTIVE}
      order by sort_order`,
    [organizationId],
  );
  return rows.map(mapRoomTemplate);
}

/**
 * Adds a room and materialises one room_elements row per element in the
 * template (docs/datamodel.md 3.7), remembering the template version so an
 * inspection keeps rendering correctly if the template changes later (3.5).
 */
export async function addRoom(
  db: SqlDriver,
  input: {
    id: string;
    inspectionId: string;
    template: RoomTemplate;
    name: string;
    sortOrder: number;
    floorLevel?: string | null;
    linkedRoomId?: string | null;
    elementIds: string[];
  },
  context: WriteContext,
): Promise<void> {
  const { template, elementIds } = input;
  if (elementIds.length !== template.elements.length) {
    throw new Error(
      `addRoom needs one id per template element (got ${elementIds.length} for ${template.elements.length})`,
    );
  }

  const timestamp = (context.now ?? utcNow)();

  await db.transaction(async (tx) => {
    await upsertRow(
      tx,
      'rooms',
      {
        id: input.id,
        inspection_id: input.inspectionId,
        room_template_id: template.id,
        room_template_version: template.version,
        name: input.name,
        sort_order: input.sortOrder,
        floor_level: input.floorLevel ?? null,
        is_completed: 0,
        linked_room_id: input.linkedRoomId ?? null,
      },
      context,
    );

    for (const [index, definition] of template.elements.entries()) {
      await upsertRow(
        tx,
        'room_elements',
        {
          id: elementIds[index] as string,
          room_id: input.id,
          element_key: definition.key,
          condition: null,
          sort_order: definition.sort_order,
          device_id: context.deviceId,
          client_updated_at: timestamp,
          sync_conflict_status: 'none',
          sub_attribute_values: toSqlJson({}),
        },
        context,
      );
    }
  });
}

/**
 * Records a condition for one element and re-evaluates whether its room is now
 * complete.
 *
 * Deel C Flow B: there is no separate "done" button — a room marks itself as
 * finished once every element has a condition and every required photo is
 * there. A button there would add friction to the screen that carries 80% of
 * the usage.
 */
export async function setElementCondition(
  db: SqlDriver,
  input: {
    elementId: string;
    roomId: string;
    condition: ElementCondition;
    description?: string | null;
    descriptionSource?: 'manual' | 'default';
  },
  context: WriteContext,
): Promise<{ roomCompleted: boolean }> {
  const timestamp = (context.now ?? utcNow)();

  return db.transaction(async (tx) => {
    await upsertRow(
      tx,
      'room_elements',
      {
        id: input.elementId,
        room_id: input.roomId,
        condition: input.condition,
        description: input.description ?? null,
        description_source: input.descriptionSource ?? null,
        device_id: context.deviceId,
        client_updated_at: timestamp,
      },
      context,
    );

    return { roomCompleted: await refreshRoomCompletion(tx, input.roomId, context) };
  });
}

export async function setElementSubAttributes(
  db: SqlDriver,
  input: { elementId: string; roomId: string; values: Record<string, string | number | boolean> },
  context: WriteContext,
): Promise<void> {
  await upsertRow(
    db,
    'room_elements',
    {
      id: input.elementId,
      room_id: input.roomId,
      sub_attribute_values: toSqlJson(input.values),
      device_id: context.deviceId,
      client_updated_at: (context.now ?? utcNow)(),
    },
    context,
  );
}

/**
 * A room is complete when every element has a condition and every element whose
 * condition demands a photo has at least one (docs/datamodel.md 3.5,
 * `requires_photo_if`).
 */
export async function refreshRoomCompletion(
  db: SqlDriver,
  roomId: string,
  context: WriteContext,
): Promise<boolean> {
  const [room] = await db.query(`select * from rooms where id = ? and ${ACTIVE}`, [roomId]);
  if (!room) return false;

  const template = await getRoomTemplate(db, String(room.room_template_id));
  const elements = await listRoomElements(db, roomId);
  const photoCounts = await countPhotosPerElement(db, roomId);

  const complete = elements.every((element) => {
    if (!element.condition) return false;

    const definition = template?.elements.find((candidate) => candidate.key === element.element_key);
    if (!definition) return true;

    if (!definition.requires_photo_if.includes(element.condition)) return true;
    return (photoCounts.get(element.id) ?? 0) > 0;
  });

  const wasComplete = fromSqlBool(room.is_completed);
  if (complete !== wasComplete) {
    await upsertRow(db, 'rooms', { id: roomId, is_completed: toSqlBool(complete) }, context);
  }

  return complete;
}

async function countPhotosPerElement(
  db: SqlDriver,
  roomId: string,
): Promise<Map<string, number>> {
  const rows = await db.query<{ room_element_id: string; total: number }>(
    `select room_element_id, count(*) as total
       from photos
      where room_id = ? and room_element_id is not null and ${ACTIVE}
      group by room_element_id`,
    [roomId],
  );
  return new Map(rows.map((row) => [row.room_element_id, row.total]));
}

/**
 * Re-translates the standard descriptions after the inspection language changes.
 *
 * Only rows still marked `default` are touched. A description the inspector
 * typed or edited is their finding and is never rewritten — but leaving the
 * untouched boilerplate behind would put Dutch sentences the inspector never
 * wrote into a French report. This is what `description_source` is for
 * (docs/datamodel.md 3.7).
 */
export async function retranslateDefaultDescriptions(
  db: SqlDriver,
  inspectionId: string,
  language: Language,
  context: WriteContext,
): Promise<number> {
  const rows = await db.query<{ id: string; room_id: string; element_key: string; room_template_id: string }>(
    `select e.id, e.room_id, e.element_key, r.room_template_id
       from room_elements e
       join rooms r on r.id = e.room_id
      where r.inspection_id = ?
        and e.description_source = 'default'
        and e.deleted_at is null and r.deleted_at is null`,
    [inspectionId],
  );
  if (rows.length === 0) return 0;

  const templates = new Map<string, RoomTemplate | null>();
  let updated = 0;

  await db.transaction(async (tx) => {
    for (const row of rows) {
      if (!templates.has(row.room_template_id)) {
        templates.set(row.room_template_id, await getRoomTemplate(tx, row.room_template_id));
      }
      const definition = templates
        .get(row.room_template_id)
        ?.elements.find((candidate) => candidate.key === row.element_key);
      if (!definition) continue;

      await upsertRow(
        tx,
        'room_elements',
        {
          id: row.id,
          description: translate(definition.default_description_translations, language),
          device_id: context.deviceId,
          client_updated_at: (context.now ?? utcNow)(),
        },
        context,
      );
      updated += 1;
    }
  });

  return updated;
}

/** Changes the inspection status, refusing any transition the flow forbids. */
export async function changeInspectionStatus(
  db: SqlDriver,
  inspectionId: string,
  to: InspectionStatus,
  context: WriteContext,
): Promise<InspectionStatus> {
  const inspection = await getInspection(db, inspectionId);
  if (!inspection) throw new Error(`Unknown inspection ${inspectionId}`);

  const next = transitionInspectionStatus(inspection.status, to);
  const timestamp = (context.now ?? utcNow)();

  await upsertRow(
    db,
    'inspections',
    {
      id: inspectionId,
      status: next,
      started_at: next === 'in_progress' ? (inspection.started_at ?? timestamp) : inspection.started_at,
      completed_at: next === 'awaiting_signatures' ? timestamp : inspection.completed_at,
      locked_at: next === 'signed' ? timestamp : inspection.locked_at,
    },
    context,
  );

  return next;
}

// --- row mapping -----------------------------------------------------------

function mapInspection(row: Record<string, unknown>): Inspection {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    property_id: String(row.property_id),
    type: row.type as Inspection['type'],
    linked_inspection_id: (row.linked_inspection_id as string) ?? null,
    status: row.status as InspectionStatus,
    inspector_user_id: String(row.inspector_user_id),
    scheduled_at: (row.scheduled_at as string) ?? null,
    started_at: (row.started_at as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    locked_at: (row.locked_at as string) ?? null,
    language: row.language as Inspection['language'],
    template_set_version: Number(row.template_set_version),
    general_notes: (row.general_notes as string) ?? null,
    weather_conditions: (row.weather_conditions as string) ?? null,
    is_furnished: row.is_furnished === null ? null : fromSqlBool(row.is_furnished),
    lease_contract_date: (row.lease_contract_date as string) ?? null,
    lease_start_date: (row.lease_start_date as string) ?? null,
    street_side_facade: (row.street_side_facade as Inspection['street_side_facade']) ?? null,
    device_id: String(row.device_id),
  };
}

function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: String(row.id),
    inspection_id: String(row.inspection_id),
    room_template_id: String(row.room_template_id),
    room_template_version: Number(row.room_template_version),
    name: String(row.name),
    sort_order: Number(row.sort_order),
    floor_level: (row.floor_level as string) ?? null,
    is_completed: fromSqlBool(row.is_completed),
    general_notes: (row.general_notes as string) ?? null,
    linked_room_id: (row.linked_room_id as string) ?? null,
  };
}

function mapRoomElement(row: Record<string, unknown>): RoomElement {
  return {
    id: String(row.id),
    room_id: String(row.room_id),
    element_key: String(row.element_key),
    condition: (row.condition as ElementCondition) ?? null,
    description: (row.description as string) ?? null,
    description_source: (row.description_source as RoomElement['description_source']) ?? null,
    sub_attribute_values: fromSqlJson(row.sub_attribute_values, {}),
    linked_element_id: (row.linked_element_id as string) ?? null,
    has_change_vs_linked:
      row.has_change_vs_linked === null ? null : fromSqlBool(row.has_change_vs_linked),
    change_description: (row.change_description as string) ?? null,
    liability: (row.liability as RoomElement['liability']) ?? null,
    sort_order: Number(row.sort_order),
    device_id: String(row.device_id),
    client_updated_at: String(row.client_updated_at),
    sync_conflict_status: row.sync_conflict_status as RoomElement['sync_conflict_status'],
  };
}

function mapRoomTemplate(row: Record<string, unknown>): RoomTemplate {
  return {
    id: String(row.id),
    organization_id: (row.organization_id as string) ?? null,
    country: row.country as RoomTemplate['country'],
    room_type: String(row.room_type),
    name_translations: fromSqlJson(row.name_translations, { nl: '' }),
    version: Number(row.version),
    is_active: fromSqlBool(row.is_active),
    elements: fromSqlJson<ElementDefinition[]>(row.elements, []),
    sort_order: Number(row.sort_order),
  };
}
