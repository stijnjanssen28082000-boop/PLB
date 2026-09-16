import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DatabaseProvider, useDatabase } from './DatabaseProvider';
import { InspectionScreen } from '@/screens/InspectionScreen';
import { showsTestBanner } from '@/platform/environment';
import { ensureDevInspection } from '@/dev/devSeed';

export function App() {
  return (
    <>
      <TestEnvironmentBanner />
      <DatabaseProvider fallback={<Booting />}>
        <Root />
      </DatabaseProvider>
    </>
  );
}

/**
 * docs/environments.md D.5: a permanent, unmissable banner in every test build,
 * never present in production. Also the app id and app name differ, so the two
 * cannot be confused on the device either.
 */
function TestEnvironmentBanner() {
  const { t } = useTranslation();
  if (!showsTestBanner) return null;
  return <div className="test-banner">{t('app.testBanner')}</div>;
}

function Booting() {
  return <div className="app-shell" />;
}

function Root() {
  const { db, writeContext } = useDatabase();
  const [inspectionId, setInspectionId] = useState<string | null>(null);

  useEffect(() => {
    // Flow A (start an inspection) is the next screen to build. Until then the
    // dev seed opens one so Flow B can be exercised on its own, which is the
    // order docs/ux.md §5 asks for.
    void ensureDevInspection(db, writeContext).then(setInspectionId);
  }, [db, writeContext]);

  if (!inspectionId) return <Booting />;
  return <InspectionScreen inspectionId={inspectionId} />;
}
