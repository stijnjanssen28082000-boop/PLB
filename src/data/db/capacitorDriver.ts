import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import type { SqlDriver, SqlParam } from './driver';

const DATABASE_NAME = 'plaatsbeschrijving';

/**
 * The device driver. The same plugin backs the browser during `npm run dev`
 * through jeep-sqlite, so Flow B can be built and tested without a phone.
 *
 * Memoised because there is one underlying connection: a second driver over it
 * would keep its own transaction depth, and two drivers each opening what they
 * think is the outer transaction fails with "cannot start a transaction within
 * a transaction". React StrictMode mounts providers twice, so this is the
 * normal case in development, not an edge one.
 */
let driverPromise: Promise<SqlDriver> | null = null;

export function createCapacitorSqlDriver(): Promise<SqlDriver> {
  driverPromise ??= openDriver();
  return driverPromise;
}

async function openDriver(): Promise<SqlDriver> {
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
  // Transactions are serialised: SQLite has one write transaction at a time, and
  // two overlapping calls would otherwise both think they own the outer one.
  // Awaits inside a transaction make that interleaving easy to hit.
  let queue: Promise<unknown> = Promise.resolve();

  const driver: SqlDriver = {
    async execute(sql, params = []) {
      await connection.run(sql, params as SqlParam[], false);
    },

    async query(sql, params = []) {
      const result = await connection.query(sql, params as SqlParam[]);
      return (result.values ?? []) as never;
    },

    transaction(fn) {
      // A nested call is already inside the queued outer transaction; queueing
      // it again would deadlock on the transaction that is waiting for it.
      if (depth > 0) return runTransaction(fn);

      const result = queue.then(() => runTransaction(fn));
      queue = result.catch(() => undefined);
      return result;
    },

    async close() {
      await connection.close();
      await sqlite.closeConnection(DATABASE_NAME, false);
    },
  };

  async function runTransaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
      // The outer level goes through the plugin's own transaction API rather
      // than a raw BEGIN: the plugin already wraps each execute in a
      // transaction, so issuing BEGIN here fails with "cannot start a
      // transaction within a transaction". Nested levels use savepoints, which
      // it passes through untouched.
      const isOuter = depth === 0;
      const savepoint = `sp_${depth}`;

      if (isOuter) {
        await connection.beginTransaction();
      } else {
        await connection.run(`SAVEPOINT ${savepoint}`, [], false);
      }
      depth += 1;

      try {
        const value = await fn(driver);
        depth -= 1;

        if (isOuter) {
          await connection.commitTransaction();
          if (Capacitor.getPlatform() === 'web') {
            // The web store only reaches IndexedDB when it is saved explicitly;
            // without this a browser reload loses the inspection.
            await sqlite.saveToStore(DATABASE_NAME);
          }
        } else {
          await connection.run(`RELEASE ${savepoint}`, [], false);
        }
        return value;
      } catch (error) {
        depth -= 1;
        if (isOuter) {
          await connection.rollbackTransaction();
        } else {
          await connection.run(`ROLLBACK TO ${savepoint}`, [], false);
        }
        throw error;
    }
  }

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
