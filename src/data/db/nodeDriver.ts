import { createRequire } from 'node:module';
import type { SqlDriver, SqlParam } from './driver';

// Resolved at runtime rather than imported statically: node:sqlite is still
// experimental, so Node leaves it out of `builtinModules`, and Vite therefore
// tries to bundle it instead of treating it as a builtin.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

/**
 * node:sqlite driver, used by the test suite so repository and sync logic can be
 * exercised against the real schema without a device or a browser. Never bundled
 * into the app.
 */
export function createNodeSqlDriver(location = ':memory:'): SqlDriver {
  const db = new DatabaseSync(location);
  db.exec('pragma foreign_keys = on');

  let depth = 0;

  const driver: SqlDriver = {
    async execute(sql, params = []) {
      db.prepare(sql).run(...(params as SqlParam[]));
    },

    async query(sql, params = []) {
      return db.prepare(sql).all(...(params as SqlParam[])) as never;
    },

    async transaction(fn) {
      // SQLite has no nested transactions; savepoints let a repository call
      // another one without either of them losing atomicity.
      const isOuter = depth === 0;
      const savepoint = `sp_${depth}`;
      db.exec(isOuter ? 'begin' : `savepoint ${savepoint}`);
      depth += 1;

      try {
        const result = await fn(driver);
        depth -= 1;
        db.exec(isOuter ? 'commit' : `release ${savepoint}`);
        return result;
      } catch (error) {
        depth -= 1;
        db.exec(isOuter ? 'rollback' : `rollback to ${savepoint}`);
        throw error;
      }
    },

    async close() {
      db.close();
    },
  };

  return driver;
}
