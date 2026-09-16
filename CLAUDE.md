# Plaatsbeschrijving-app

Offline-first inspection app (plaatsbeschrijving / état des lieux) for professional
property inspectors in Belgium. React + TypeScript + Vite, packaged with Capacitor
for Android and iOS; Supabase (Postgres, Auth, Storage, Edge Functions) in an EU region.

The full product reference lives in `docs/`. It is the source of truth — when code
and docs disagree, the docs are changed first, then the code.

| Document | Covers |
|---|---|
| `docs/concept.md` | Deel A — business context, scope, architecture, plan |
| `docs/datamodel.md` | Deel B — all tables, relations, developer rules |
| `docs/ux.md` | Deel C — design principles, core screens, per-screen design checks |
| `docs/environments.md` | Deel D — development / test / production separation |

## Working rules

1. Read `docs/datamodel.md` before writing a table, model or sync logic.
2. Read `docs/ux.md` before and while building any screen. The principles in C.2
   are hard requirements, not suggestions: large touch targets, high contrast,
   minimal text entry.
3. After building a screen, run the design checks in `docs/ux.md` §6 immediately,
   before moving to the next screen. A screen that is functionally correct but has
   not passed the accessibility review is not finished.
4. Reliability and speed of the core flow (Flow B) outrank visual polish elsewhere.
   This is a pilot product for a professional on site, not a consumer app.
5. Work against the **test** environment by default, never production.

## Non-negotiable technical rules

These come from `docs/datamodel.md` §6 and `docs/environments.md`. Breaking one of
these is a bug even if the feature works.

- **UUIDs are generated on the device.** Never rely on server-side generation for
  anything that can be created offline.
- **All writes go through the repository layer** (`src/data/repositories/`), which
  writes the local row *and* its `sync_queue` row in one transaction. No SQL in
  components.
- **`inspections.status` changes go through `transitionInspectionStatus()`.** Invalid
  transitions throw.
- **Nothing is hard-deleted.** Soft delete via `deleted_at` — evidence value in disputes.
- **Everything after `signed` is immutable** except AI suggestions and report approval.
- **No hardcoded user-facing strings.** Every label, error, empty state and status
  message goes through i18next (`src/i18n/locales/*.json`). Missing translations fall
  back to NL, never to an empty string.
- **Legal texts are code, not data** (`legal_texts/{region}/{language}/*.md`). They are
  legislation: copied verbatim, never generated, paraphrased or summarised by AI, and
  never editable by a user.
- **No AI calls in v1.** The `ai_suggestions` schema exists but stays empty until v1.x
  introduces AI explicitly. Do not add Claude API calls "ready for later".
- **No Supabase key in source**, not even temporarily for a test. Keys come from the
  environment configuration only.
- **In the test environment every outgoing mail is redirected** to the whitelisted test
  address with the original recipient in the subject. This guard is built before the
  mail function is first tested, not after.

## Commands

```bash
npm run dev          # browser dev server (fastest loop for Flow B)
npm run typecheck    # tsc, no emit
npm run test         # vitest
npm run lint         # eslint
npm run build        # production bundle
```

## Branches

`main` mirrors production, `develop` mirrors test, feature branches merge into
`develop` via pull request. Never promote from development straight to production.
