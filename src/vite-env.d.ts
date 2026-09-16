/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MAIL_TEST_WHITELIST?: string;
  readonly VITE_HIDE_TEST_BANNER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
