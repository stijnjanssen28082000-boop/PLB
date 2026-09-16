/**
 * The one SQL surface the app talks to.
 *
 * Three things implement it: Capacitor SQLite on the device, the same plugin's
 * web build during `npm run dev`, and node:sqlite in tests. Keeping the surface
 * this small is what makes the repository layer testable without a device.
 */
export interface SqlDriver {
  execute(sql: string, params?: SqlParam[]): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /**
   * Runs `fn` inside a transaction, rolling back if it throws.
   *
   * Every repository write uses this: the row and its sync_queue entry must
   * land together or not at all (docs/datamodel.md §6.2). A row that synced
   * without a queue entry is a change that silently never reaches the server.
   */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type SqlParam = string | number | null | Uint8Array;

/** SQLite has no boolean type; the schema stores them as 0/1 integers. */
export const toSqlBool = (value: boolean | null | undefined): number | null =>
  value === null || value === undefined ? null : value ? 1 : 0;

export const fromSqlBool = (value: unknown): boolean => value === 1 || value === true;

/** JSON columns are text in SQLite and jsonb on the server. */
export const toSqlJson = (value: unknown): string => JSON.stringify(value ?? null);

export function fromSqlJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed === null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}
