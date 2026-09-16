import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import type { SqlDriver, SqlParam } from './driver';

const DATABASE_NAME = 'plaatsbeschrijving';

/**
 * The device driver. The same plugin backs the browser during `npm run dev`
 * through jeep-sqlite, so Flow B can be built and tested without a phone.
 */
export async function createCapacitorSqlDriver(): Promise<SqlDriver> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  if (Capacitor.getPlatform() === 'web') {
    // jeep-sqlite renders the wasm-backed store into this element.
    const element = document.createElement('jeep-sqlite');
    document.body.appendChild(element);
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }

  const connection = await openConnection(sqlite);
  await connection.open();

  let depth = 0;

  const driver: SqlDriver = {
    async execute(sql, params = []) {
      await connection.run(sql, params as SqlParam[], false);
    },

    async query(sql, params = []) {
      const result = await connection.query(sql, params as SqlParam[]);
      return (result.values ?? []) as never;
    },

    async transaction(fn) {
      const isOuter = depth === 0;
      const savepoint = `sp_${depth}`;
      await connection.execute(isOuter ? 'BEGIN;' : `SAVEPOINT ${savepoint};`, false);
      depth += 1;

      try {
        const value = await fn(driver);
        depth -= 1;
        await connection.execute(isOuter ? 'COMMIT;' : `RELEASE ${savepoint};`, false);
        if (isOuter && Capacitor.getPlatform() === 'web') {
          // The web store only reaches IndexedDB when it is saved explicitly;
          // without this a browser reload loses the inspection.
          await sqlite.saveToStore(DATABASE_NAME);
        }
        return value;
      } catch (error) {
        depth -= 1;
        await connection.execute(isOuter ? 'ROLLBACK;' : `ROLLBACK TO ${savepoint};`, false);
        throw error;
      }
    },

    async close() {
      await connection.close();
      await sqlite.closeConnection(DATABASE_NAME, false);
    },
  };

  return driver;
}

async function openConnection(sqlite: SQLiteConnection): Promise<SQLiteDBConnection> {
  // A connection left behind by a hot reload would otherwise make this throw.
  const isConsistent = (await sqlite.checkConnectionsConsistency()).result ?? false;
  const isOpen = (await sqlite.isConnection(DATABASE_NAME, false)).result ?? false;

  if (isConsistent && isOpen) {
    return sqlite.retrieveConnection(DATABASE_NAME, false);
  }
  return sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false);
}
