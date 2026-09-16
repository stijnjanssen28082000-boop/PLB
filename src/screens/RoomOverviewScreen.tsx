import { useTranslation } from 'react-i18next';
import { StatusChip, type RoomStatus } from '@/components/StatusChip';
import type { Room } from '@/domain/types';

export interface RoomProgress {
  room: Room;
  /** Elements that still have no condition. */
  remaining: number;
  total: number;
}

/**
 * Flow B, step 1: the list of rooms with a visible status for each.
 *
 * C.2 principle 6 — progress stays on screen. The inspector should be able to
 * tell at a glance how much of the property is done without opening anything.
 */
export function RoomOverviewScreen({
  rooms,
  onOpenRoom,
  onAddRoom,
}: {
  rooms: RoomProgress[];
  onOpenRoom: (roomId: string) => void;
  onAddRoom: () => void;
}) {
  const { t } = useTranslation();

  const completed = rooms.filter((entry) => entry.room.is_completed).length;
  const percentage = rooms.length === 0 ? 0 : Math.round((completed / rooms.length) * 100);

  return (
    <>
      <div className="app-content">
        {rooms.length > 0 && (
          <div className="progress">
            <div
              className="progress__bar"
              role="progressbar"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={rooms.length}
              aria-label={t('rooms.progress', { completed, total: rooms.length })}
            >
              <div className="progress__fill" style={{ width: `${percentage}%` }} />
            </div>
            <div className="progress__label">
              {t('rooms.progress', { completed, total: rooms.length })}
            </div>
          </div>
        )}

        {rooms.length === 0 ? (
          <p className="empty-state">{t('rooms.empty')}</p>
        ) : (
          <ul className="room-list">
            {rooms.map(({ room, remaining, total }) => (
              <li key={room.id}>
                <button type="button" className="room-card" onClick={() => onOpenRoom(room.id)}>
                  <span className="room-card__body">
                    <span className="room-card__name">{room.name}</span>
                    <span className="room-card__meta">
                      {room.is_completed
                        ? `${total} / ${total}`
                        : t('rooms.elementsRemaining', { count: remaining })}
                    </span>
                  </span>
                  <StatusChip status={statusOf(room, remaining, total)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom bar: C.2 principle 1, reachable with the thumb of the hand
          already holding the phone. */}
      <div className="action-bar">
        <button type="button" className="button button--primary" onClick={onAddRoom}>
          {t('rooms.add')}
        </button>
      </div>
    </>
  );
}

function statusOf(room: Room, remaining: number, total: number): RoomStatus {
  if (room.is_completed) return 'completed';
  return remaining === total ? 'not_started' : 'in_progress';
}
