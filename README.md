# Plaatsbeschrijving-app

Offline-first inspection app (plaatsbeschrijving / état des lieux) for professional
property inspectors in Belgium. An inspector walks a property room by room with no
connection, records each element with structured findings and photos, and the
parties sign on the device. Everything syncs when there is signal, after which a
PDF report is generated and mailed to every party.

The product reference is in [`docs/`](./docs/README.md) and is the source of truth:
concept, data model, UX guidelines, and the environment separation. Working rules
for making changes are in [`CLAUDE.md`](./CLAUDE.md).

## Getting started

```bash
npm install
cp .env.test.example .env.test   # fill in the test Supabase project
npm run dev                      # http://localhost:5173
```

`npm run dev` opens straight into Flow B against a local SQLite database seeded
with demo data, so the core screen can be worked on without a backend or a phone.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Browser dev server — the fastest loop for Flow B |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (data layer, contrast rules, mail guard) |
| `npm run build` | Production bundle |
| `npm run seed:generate` | Regenerate `supabase/seed.sql` from the starter kit |
| `./scripts/test-migrations.sh` | Apply every migration to a throwaway Postgres and check the schema rules |

## Where things live

| Path | Contents |
|---|---|
| `src/domain/` | Types, the inspection status flow, the global room template starter kit |
| `src/data/db/` | SQLite drivers and the local schema, mirroring Postgres |
| `src/data/repositories/` | The only write path — local row plus its sync-queue entry, atomically |
| `src/screens/`, `src/components/` | Flow B |
| `src/i18n/` | NL/FR/EN app-chrome translations |
| `src/styles/` | Design tokens for field use, with the contrast rules as tests |
| `src/platform/` | Device id, camera, environment config, the test mail guard |
| `supabase/` | Postgres migrations, RLS, generated seed, schema-rule tests |

## Current state

Built: the Postgres schema with its evidence rules, the local database and
repository layer, i18n, the design system, and **Flow B** (room inspection) end to
end against local storage.

Not built yet: Flows A, C, D and E, sync against the server, PDF generation and
mailing, the backoffice (Flow F) and the party comments page (Flow G). AI features
are deliberately out of version 1 — the `ai_suggestions` schema exists but stays
empty.

## Environments

Development, test and production are separate, and the app builds against one of
them — there is no runtime switch. A test build carries a permanent banner, its
own app id and its own name on the device, so it cannot be mistaken for
production. Outside production, every outgoing mail is rerouted to a whitelisted
address with the intended recipient in the subject, and sending is refused
outright if no whitelist is configured.

`develop` mirrors test, `main` mirrors production, and production is deployed from
a version tag. Details in [`docs/environments.md`](./docs/environments.md).
