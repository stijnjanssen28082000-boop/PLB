import { useTranslation } from 'react-i18next';
import { SELECTABLE_CONDITIONS, type ElementCondition } from '@/domain/types';
import { CONDITION_COLORS } from '@/styles/tokens';

/**
 * The four condition buttons (docs/ux.md Flow B, step 2).
 *
 * The order is fixed and the positions never move between elements — after a
 * few inspections the inspector stops reading them and goes by muscle memory,
 * which is where the time saving in this screen actually comes from.
 */
export function ConditionSelector({
  value,
  allowed,
  onChange,
}: {
  value: ElementCondition | null;
  allowed: ElementCondition[];
  onChange: (condition: ElementCondition) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="condition-grid" role="group" aria-label={t('element.chooseCondition')}>
      {SELECTABLE_CONDITIONS.map((condition) => {
        // A template may offer fewer options, but the button keeps its slot so
        // the layout does not shift from one element to the next.
        const isAllowed = allowed.includes(condition);
        const isSelected = value === condition;
        const colors = CONDITION_COLORS[condition];

        return (
          <button
            key={condition}
            type="button"
            className="condition-button"
            aria-pressed={isSelected}
            disabled={!isAllowed}
            onClick={() => onChange(condition)}
            style={
              {
                '--fill': colors.fill,
                '--fill-text': colors.text,
              } as React.CSSProperties
            }
          >
            {/* A non-colour confirmation of which one is chosen. */}
            {isSelected && (
              <span className="condition-button__check" aria-hidden="true">
                ✓
              </span>
            )}
            <span>{t(`condition.${condition}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
