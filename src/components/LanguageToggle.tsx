import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '@/domain/types';

/**
 * docs/ux.md C.3b: language codes, not a dropdown of full country names — a
 * dropdown is too slow for field use.
 *
 * This sits in the Flow B header from the first version of the screen, because
 * Flow B is where it gets used: the tenant reads along during the walk-through
 * and may want their own language.
 *
 * Controlled, because what a tap changes depends on where the toggle is. In
 * Flow B it sets the inspection's language, which is the report language — see
 * InspectionScreen.
 */
export function LanguageToggle({
  value,
  onChange,
  label,
}: {
  value: Language;
  onChange: (language: Language) => void;
  label?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="language-toggle" role="group" aria-label={label ?? t('language.change')}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          className="language-toggle__option"
          aria-pressed={value === language}
          onClick={() => onChange(language)}
        >
          <span aria-hidden="true">{t(`language.${language}`)}</span>
          <span className="visually-hidden">{t(`language.${language}Full`)}</span>
        </button>
      ))}
    </div>
  );
}
