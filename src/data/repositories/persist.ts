import type { SqlDriver, SqlParam } from '@/data/db/driver';

/**
 * The single write path (docs/datamodel.md §6.2).
 *
 * Every change writes the local row and its sync_queue row inside one
 * transaction. They must land together: a row that reaches SQLite without a
 * queue entry is a change that silently never reaches the server, which on an
 * offline-first app means a finished inspection that quietly loses a wall.
 */

export type Row = Record<string, SqlParam | undefined>;

export interface WriteContext {
  deviceId: string;
  /** Injectable so tests can control the clock; defaults to now, in UTC. */
  now?: () => string;
}

export const utcNow = (): string => new Date().toISOString();

/** Tables whose rows only live on the device, so they are never queued. */
const LOCAL_ONLY_TABLES = new Set(['sync_queue', 'schema_version']);

/**
 * Writes a row, merging `changes` into whatever is already stored.
 *
 * Callers pass only the fields they are changing, but what gets written — and
 * what gets queued — is always the complete row. Two reasons, both from the
 * datamodel: the sync_queue payload is specified as the full row on an upsert
 * (3.16), and a partial insert would trip the NOT NULL constraints of the
 * columns the caller left out.
 */
export async function upsertRow(
  db: SqlDriver,
  table: string,
  changes: Row,
  context: WriteContext,
): Promise<void> {
  const timestamp = (context.now ?? utcNow)();
  const id = changes.id as string;

  await db.transaction(async (tx) => {
    const [existing] = await tx.query<Row>(`select * from ${table} where id = ?`, [id]);

    const merged: Row = {
      ...(existing ?? {}),
      ...stripUndefined(changes),
      updated_at: timestamp,
    };
    if (merged.created_at === undefined || merged.created_at === null) {
      merged.created_at = timestamp;
    }

    const columns = Object.keys(merged).filter((key) => merged[key] !== undefined);
    const placeholders = columns.map(() => '?').join(', ');
    const params = columns.map((key) => merged[key] as SqlParam);

    await tx.execute(
      `insert or replace into ${table} (${columns.join(', ')}) values (${placeholders})`,
      params,
    );

    if (!LOCAL_ONLY_TABLES.has(table)) {
      await enqueue(tx, {
        entity_type: table,
        entity_id: id,
        operation: 'upsert',
        payload: JSON.stringify(merged),
        device_id: context.deviceId,
        client_updated_at: timestamp,
        created_at: timestamp,
      });
    }
  });
}

function stripUndefined(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

/**
 * Soft delete (docs/datamodel.md conventions): nothing is ever physically
 * removed, because a deleted photo or element is still evidence in a dispute.
 */
export async function softDeleteRow(
  db: SqlDriver,
  table: string,
  id: string,
  context: WriteContext,
): Promise<void> {
  const clock = context.now ?? utcNow;
  const timestamp = clock();

  await db.transaction(async (tx) => {
    await tx.execute(`update ${table} set deleted_at = ?, updated_at = ? where id = ?`, [
      timestamp,
      timestamp,
      id,
    ]);

    await enqueue(tx, {
      entity_type: table,
      entity_id: id,
      operation: 'soft_delete',
      payload: null,
      device_id: context.deviceId,
      client_updated_at: timestamp,
      created_at: timestamp,
    });
  });
}

/** Queues a photo or signature file for upload after its metadata row. */
export async function enqueueFileUpload(
  db: SqlDriver,
  entityType: 'photos' | 'signatures',
  entityId: string,
  localPath: string,
  context: WriteContext,
): Promise<void> {
  const timestamp = (context.now ?? utcNow)();

  await enqueue(db, {
    entity_type: entityType,
    entity_id: entityId,
    operation: 'upload_file',
    payload: null,
    file_local_path: localPath,
    device_id: context.deviceId,
    client_updated_at: timestamp,
    created_at: timestamp,
  });
}

interface QueueEntry {
  entity_type: string;
  entity_id: string;
  operation: 'upsert' | 'soft_delete' | 'upload_file';
  payload: string | null;
  file_local_path?: string;
  device_id: string;
  client_updated_at: string;
  created_at: string;
}

async function enqueue(db: SqlDriver, entry: QueueEntry): Promise<void> {
  await db.execute(
    `insert into sync_queue
       (entity_type, entity_id, operation, payload, file_local_path, device_id, client_updated_at, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.entity_type,
      entry.entity_id,
      entry.operation,
      entry.payload,
      entry.file_local_path ?? null,
      entry.device_id,
      entry.client_updated_at,
      entry.created_at,
    ],
  );
}
