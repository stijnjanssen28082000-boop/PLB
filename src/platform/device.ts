import type { SqlDriver } from '@/data/db/driver';

/**
 * The device identity that rides along on every row (docs/datamodel.md 3.7):
 * it is what lets the server tell a second device's write apart from this one's
 * and park the conflict instead of overwriting.
 *
 * Generated once and kept in the local database rather than in localStorage,
 * so it survives for exactly as long as the inspections it is stamped on.
 */
const DEVICE_ID_KEY = 'device_id';

export async function getDeviceId(db: SqlDriver): Promise<string> {
  await db.execute(`create table if not exists device_settings (
    key text primary key,
    value text not null
  )`);

  const [existing] = await db.query<{ value: string }>(
    'select value from device_settings where key = ?',
    [DEVICE_ID_KEY],
  );
  if (existing) return existing.value;

  const deviceId = crypto.randomUUID();
  await db.execute('insert into device_settings (key, value) values (?, ?)', [
    DEVICE_ID_KEY,
    deviceId,
  ]);
  return deviceId;
}

/** UUIDs are generated on the device, never by the server (§6.1). */
export const newId = (): string => crypto.randomUUID();
