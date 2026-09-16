import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Language } from '@/domain/types';
import nl from './locales/nl.json';
import fr from './locales/fr.json';
import en from './locales/en.json';

/**
 * App-chrome translations (docs/datamodel.md 3.5b): static files in the codebase
 * rather than database rows, so the app has its interface language before it has
 * ever synced, and a wording change is a normal commit instead of a migration.
 *
 * Templates and their default descriptions are a different thing: those live in
 * the database, because they differ per customer.
 */

const STORAGE_KEY = 'plb.language';

export const initI18n = (initialLanguage: Language = detectInitialLanguage()) =>
  i18next.use(initReactI18next).init({
    resources: {
      nl: { translation: nl },
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: initialLanguage,
    // Never show an empty string: a missing key falls back to Dutch (3.5).
    fallbackLng: 'nl',
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  });

function detectInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'nl' || stored === 'fr' || stored === 'en') return stored;

  const browser = navigator.language.slice(0, 2).toLowerCase();
  return browser === 'fr' || browser === 'en' ? browser : 'nl';
}

/**
 * Changes the inspector's own interface language (docs/ux.md C.3b, level 1).
 * Deliberately separate from the inspection's language, which decides the
 * report and the mails to the parties.
 */
export async function setInterfaceLanguage(language: Language): Promise<void> {
  localStorage.setItem(STORAGE_KEY, language);
  await i18next.changeLanguage(language);
}

export default i18next;
