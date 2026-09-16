import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SqlDriver } from '@/data/db/driver';
import { migrateLocalDatabase } from '@/data/db/migrations';
import { createCapacitorSqlDriver } from '@/data/db/capacitorDriver';
import type { WriteContext } from '@/data/repositories/persist';
import { getDeviceId } from '@/platform/device';

interface DatabaseValue {
  db: SqlDriver;
  writeContext: WriteContext;
}

const DatabaseContext = createContext<DatabaseValue | null>(null);

/**
 * Opening the database, migrating it and reading the device id happen exactly
 * once. Memoised as a whole rather than per step because React StrictMode runs
 * this effect twice: two concurrent migrations would each try to open the outer
 * transaction and the second would fail.
 */
let databasePromise: Promise<DatabaseValue> | null = null;

function openDatabase(): Promise<DatabaseValue> {
  databasePromise ??= (async () => {
    const db = await createCapacitorSqlDriver();
    await migrateLocalDatabase(db);
    return { db, writeContext: { deviceId: await getDeviceId(db) } };
  })();
  return databasePromise;
}

export function useDatabase(): DatabaseValue {
  const value = useContext(DatabaseContext);
  if (!value) throw new Error('useDatabase must be used inside a DatabaseProvider');
  return value;
}

export function DatabaseProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const [value, setValue] = useState<DatabaseValue | null>(null);

  useEffect(() => {
    let cancelled = false;

    void openDatabase().then((opened) => {
      if (!cancelled) setValue(opened);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!value) return <>{fallback}</>;
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}
