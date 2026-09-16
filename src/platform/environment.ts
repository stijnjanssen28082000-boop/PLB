/**
 * Environment configuration (docs/environments.md D.4).
 *
 * Which backend the app talks to is decided by the build, never by code. There
 * is no runtime switch and no hardcoded key: the API key itself is what decides
 * which database you are talking to, which is the whole point of two separate
 * Supabase projects (D.3).
 */

declare const __APP_ENV__: string;

export type AppEnvironment = 'test' | 'production';

export const APP_ENVIRONMENT: AppEnvironment = __APP_ENV__ === 'production' ? 'production' : 'test';

export const isProduction = APP_ENVIRONMENT === 'production';
export const isTestEnvironment = APP_ENVIRONMENT === 'test';

/**
 * D.5: a test build must be impossible to mistake for production, even by the
 * person who built it, at the end of a long day.
 */
export const showsTestBanner =
  isTestEnvironment && import.meta.env.VITE_HIDE_TEST_BANNER !== 'true';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function readSupabaseConfig(): SupabaseConfig {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      `Missing Supabase configuration for the ${APP_ENVIRONMENT} environment. ` +
        `Copy .env.${APP_ENVIRONMENT}.example to .env.${APP_ENVIRONMENT} and fill it in.`,
    );
  }

  return { url, anonKey };
}

/**
 * The whitelist that keeps a test mail away from a real tenant (D.7). Empty in
 * production, where mail goes to the actual recipient.
 */
export function readMailWhitelist(): string[] {
  const raw = import.meta.env.VITE_MAIL_TEST_WHITELIST ?? '';
  return raw
    .split(',')
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
}
