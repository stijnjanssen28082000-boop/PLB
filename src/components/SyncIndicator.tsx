import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/styles/tokens';

export type SyncState = 'offline' | 'syncing' | 'synced';

const STATE_COLOR: Record<SyncState, string> = {
  offline: COLORS.syncOffline,
  syncing: COLORS.syncPending,
  synced: COLORS.syncDone,
};

/**
 * Flow E: a permanently visible status, not a screen of its own.
 *
 * C.2 principle 5 — the inspector must always know, without thinking, whether
 * their work is safe on the device and whether it has reached the server.
 * Uncertainty here is the fastest way to lose their trust in the app.
 */
export function SyncIndicator({ pendingCount }: { pendingCount: number }) {
  const { t } = useTranslation();
  const online = useOnlineStatus();

  const state: SyncState = !online ? 'offline' : pendingCount > 0 ? 'syncing' : 'synced';

  return (
    <button
      type="button"
      className="button button--ghost"
      aria-label={`${t(`sync.${state}`)} — ${t(`sync.${state}Explanation`)}`}
      style={{ color: 'inherit', gap: 8, paddingInline: 10 }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: STATE_COLOR[state],
          // A white ring keeps the dot visible on the dark header whichever
          // state it is in.
          boxShadow: `0 0 0 2px ${COLORS.textInverse}`,
          flexShrink: 0,
        }}
      />
      <span className="sync-indicator__label">{t(`sync.${state}`)}</span>
    </button>
  );
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
