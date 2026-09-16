import { beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDriver } from '@/data/db/nodeDriver';
import { migrateLocalDatabase } from '@/data/db/migrations';
import type { SqlDriver } from '@/data/db/driver';
import { GLOBAL_ROOM_TEMPLATES } from '@/domain/templates/starterKit';
import type { RoomTemplate } from '@/domain/types';
import {
  addRoom,
  changeInspectionStatus,
  listRoomElements,
  listRooms,
  setElementCondition,
} from './inspectionRepository';
import { addPhoto, removePhoto } from './photoRepository';
import { toSqlJson } from '@/data/db/driver';
import { upsertRow, type WriteContext } from './persist';

const CONTEXT: WriteContext = { deviceId: 'device-a' };

const ORG = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const PROPERTY = '44444444-4444-4444-8444-444444444444';
const INSPECTION = '55555555-5555-4555-8555-555555555555';

/** The bedroom template: base elements plus a built-in wardrobe. */
const bedroomTemplate = (): RoomTemplate =>
  GLOBAL_ROOM_TEMPLATES.find((template) => template.room_type === 'bedroom')!;

async function seedDatabase(db: SqlDriver): Promise<void> {
  await migrateLocalDatabase(db);

  for (const template of GLOBAL_ROOM_TEMPLATES) {
    await db.execute(
      `insert into room_templates
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
        '2026-09-16T08:00:00.000Z',
        '2026-09-16T08:00:00.000Z',
      ],
    );
  }

  await upsertRow(
    db,
    'properties',
    {
      id: PROPERTY,
      organization_id: ORG,
      street: 'Teststraat',
      house_number: '1',
      postal_code: '2000',
      city: 'Antwerpen',
      country: 'BE',
      region: 'vlaanderen',
      property_type: 'apartment',
    },
    CONTEXT,
  );

  await upsertRow(
    db,
    'inspections',
    {
      id: INSPECTION,
      organization_id: ORG,
      property_id: PROPERTY,
      type: 'entry',
      status: 'draft',
      inspector_user_id: USER,
      language: 'nl',
      device_id: CONTEXT.deviceId,
      street_side_facade: 'north',
    },
    CONTEXT,
  );
}

async function createBedroom(db: SqlDriver): Promise<{ roomId: string; elementIds: string[] }> {
  const template = bedroomTemplate();
  const roomId = crypto.randomUUID();
  const elementIds = template.elements.map(() => crypto.randomUUID());

  await addRoom(
    db,
    { id: roomId, inspectionId: INSPECTION, template, name: 'Slaapkamer 1', sortOrder: 1, elementIds },
    CONTEXT,
  );

  return { roomId, elementIds };
}

describe('local data layer', () => {
  let db: SqlDriver;

  beforeEach(async () => {
    db = createNodeSqlDriver();
    await seedDatabase(db);
  });

  it('applies the local migrations and records the schema version', async () => {
    const rows = await db.query<{ version: number }>('select version from schema_version');
    expect(rows).toEqual([{ version: 1 }]);
  });

  it('materialises one element row per template element when a room is added', async () => {
    const template = bedroomTemplate();
    const { roomId } = await createBedroom(db);

    const elements = await listRoomElements(db, roomId);
    expect(elements).toHaveLength(template.elements.length);
    expect(elements.map((element) => element.element_key)).toEqual(
      template.elements.map((definition) => definition.key),
    );
    // The four walls are separate elements, in report order.
    expect(elements.slice(0, 4).map((element) => element.element_key)).toEqual([
      'wall_north',
      'wall_east',
      'wall_south',
      'wall_west',
    ]);
  });

  it('queues every write for sync, in the order it happened', async () => {
    const { roomId, elementIds } = await createBedroom(db);
    const queue = await db.query<{ entity_type: string; operation: string }>(
      'select entity_type, operation from sync_queue order by id',
    );

    // properties, inspections, then the room followed by its elements.
    expect(queue[0]).toEqual({ entity_type: 'properties', operation: 'upsert' });
    expect(queue[1]).toEqual({ entity_type: 'inspections', operation: 'upsert' });
    expect(queue[2]).toEqual({ entity_type: 'rooms', operation: 'upsert' });
    expect(queue.filter((entry) => entry.entity_type === 'room_elements')).toHaveLength(
      elementIds.length,
    );
    expect(roomId).toBeTruthy();
  });

  it('rolls back the row and its queue entry together when a write fails', async () => {
    const template = bedroomTemplate();

    await expect(
      addRoom(
        db,
        {
          id: crypto.randomUUID(),
          inspectionId: 'nonexistent-inspection',
          template,
          name: 'Slaapkamer 1',
          sortOrder: 1,
          elementIds: template.elements.map(() => crypto.randomUUID()),
        },
        CONTEXT,
      ),
    ).rejects.toThrow();

    expect(await listRooms(db, INSPECTION)).toHaveLength(0);
    const queue = await db.query('select * from sync_queue where entity_type = ?', ['rooms']);
    expect(queue).toHaveLength(0);
  });

  describe('room completion', () => {
    it('completes a room once every element has a condition', async () => {
      const { roomId, elementIds } = await createBedroom(db);
      const template = bedroomTemplate();

      let completed = false;
      for (const [index, definition] of template.elements.entries()) {
        const result = await setElementCondition(
          db,
          {
            elementId: elementIds[index]!,
            roomId,
            condition: 'good',
            description: definition.default_description_translations.nl,
            descriptionSource: 'default',
          },
          CONTEXT,
        );
        completed = result.roomCompleted;
      }

      expect(completed).toBe(true);
      const [room] = await listRooms(db, INSPECTION);
      expect(room?.is_completed).toBe(true);
    });

    it('holds a room open while a damaged element still has no photo', async () => {
      const { roomId, elementIds } = await createBedroom(db);
      const template = bedroomTemplate();

      for (const [index] of template.elements.entries()) {
        // The north wall is damaged, so it needs a photo before the room counts.
        const condition = index === 0 ? 'damaged' : 'good';
        await setElementCondition(
          db,
          { elementId: elementIds[index]!, roomId, condition },
          CONTEXT,
        );
      }

      let [room] = await listRooms(db, INSPECTION);
      expect(room?.is_completed).toBe(false);

      const photoId = crypto.randomUUID();
      await addPhoto(
        db,
        {
          id: photoId,
          organizationId: ORG,
          inspectionId: INSPECTION,
          roomId,
          roomElementId: elementIds[0]!,
          localPath: 'photos/1.jpg',
          sha256: 'abc123',
          takenAt: '2026-09-16T10:00:00.000Z',
          sortOrder: 1,
        },
        CONTEXT,
      );

      [room] = await listRooms(db, INSPECTION);
      expect(room?.is_completed).toBe(true);

      // Deleting that photo must reopen the room rather than leave it complete
      // with nothing to back the finding up.
      await removePhoto(db, photoId, CONTEXT);
      [room] = await listRooms(db, INSPECTION);
      expect(room?.is_completed).toBe(false);
    });

    it('does not ask for a photo when an element is fine', async () => {
      const { roomId, elementIds } = await createBedroom(db);
      const template = bedroomTemplate();

      for (const [index] of template.elements.entries()) {
        await setElementCondition(
          db,
          { elementId: elementIds[index]!, roomId, condition: 'not_applicable' },
          CONTEXT,
        );
      }

      const [room] = await listRooms(db, INSPECTION);
      expect(room?.is_completed).toBe(true);
    });
  });

  describe('photos', () => {
    it('queues the file after its metadata row', async () => {
      const { roomId, elementIds } = await createBedroom(db);

      await addPhoto(
        db,
        {
          id: crypto.randomUUID(),
          organizationId: ORG,
          inspectionId: INSPECTION,
          roomId,
          roomElementId: elementIds[0]!,
          localPath: 'photos/1.jpg',
          sha256: 'abc123',
          takenAt: '2026-09-16T10:00:00.000Z',
          sortOrder: 1,
        },
        CONTEXT,
      );

      const queue = await db.query<{ entity_type: string; operation: string }>(
        `select entity_type, operation from sync_queue where entity_type = 'photos' order by id`,
      );
      expect(queue).toEqual([
        { entity_type: 'photos', operation: 'upsert' },
        { entity_type: 'photos', operation: 'upload_file' },
      ]);
    });
  });

  describe('status transitions', () => {
    it('follows the documented flow', async () => {
      expect(await changeInspectionStatus(db, INSPECTION, 'in_progress', CONTEXT)).toBe('in_progress');
      expect(await changeInspectionStatus(db, INSPECTION, 'awaiting_signatures', CONTEXT)).toBe(
        'awaiting_signatures',
      );
    });

    it('refuses a transition the flow does not allow', async () => {
      await expect(changeInspectionStatus(db, INSPECTION, 'approved', CONTEXT)).rejects.toThrow(
        /draft -> approved/,
      );
    });

    it('sets locked_at when the inspection is signed', async () => {
      await changeInspectionStatus(db, INSPECTION, 'in_progress', CONTEXT);
      await changeInspectionStatus(db, INSPECTION, 'awaiting_signatures', CONTEXT);
      await changeInspectionStatus(db, INSPECTION, 'signed', CONTEXT);

      const [row] = await db.query<{ locked_at: string | null }>(
        'select locked_at from inspections where id = ?',
        [INSPECTION],
      );
      expect(row?.locked_at).toBeTruthy();
    });
  });
});
