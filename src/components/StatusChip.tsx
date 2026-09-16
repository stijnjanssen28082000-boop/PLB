import { useTranslation } from 'react-i18next';
import { CONDITION_COLORS } from '@/styles/tokens';

export type RoomStatus = 'not_started' | 'in_progress' | 'completed';

/**
 * Room status in the overview list (Flow B, step 1).
 *
 * Carries its own text, not only a colour: C.2 asks for readability in bright
 * sun, where a fill is the first thing to wash out.
 */
const STATUS_STYLE: Record<RoomStatus, { fill: string; text: string }> = {
  not_started: { fill: CONDITION_COLORS.not_applicable.fill, text: CONDITION_COLORS.not_applicable.text },
  in_progress: { fill: CONDITION_COLORS.traces_of_use.fill, text: CONDITION_COLORS.traces_of_use.text },
  completed: { fill: CONDITION_COLORS.good.fill, text: CONDITION_COLORS.good.text },
};

export function StatusChip({ status }: { status: RoomStatus }) {
  const { t } = useTranslation();
  const style = STATUS_STYLE[status];

  return (
    <span
      className="status-chip"
      style={{ '--chip-fill': style.fill, '--chip-text': style.text } as React.CSSProperties}
    >
      {t(`rooms.status.${status}`)}
    </span>
  );
}
