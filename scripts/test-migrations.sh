#!/usr/bin/env bash
#
# Runs every migration plus the seed against a throwaway Postgres and then
# exercises the rules in supabase/test/schema_rules_test.sql.
#
# Works without a Supabase project: supabase/test/supabase_stubs.sql stands in
# for the auth and storage schemas Supabase normally provides.
#
# Usage:
#   scripts/test-migrations.sh                  # start a temporary local server
#   DATABASE_URL=postgres://... scripts/test-migrations.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql_cmd=(psql "$DATABASE_URL")
else
  pgbin="${PGBIN:-/usr/lib/postgresql/16/bin}"
  workdir="$(mktemp -d)"
  export PGDATA="$workdir/data"
  sock="$workdir/sock"
  mkdir -p "$PGDATA" "$sock"

  cleanup() {
    "$pgbin/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
    rm -rf "$workdir"
  }
  trap cleanup EXIT

  "$pgbin/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
  "$pgbin/pg_ctl" -D "$PGDATA" -o "-k $sock -h ''" -l "$PGDATA/log" start >/dev/null
  psql_cmd=(psql -h "$sock" -U postgres -d postgres)
fi

run_sql() {
  "${psql_cmd[@]}" -v ON_ERROR_STOP=1 -q -f "$1"
}

echo "==> Supabase stubs"
run_sql supabase/test/supabase_stubs.sql

echo "==> Migrations"
for migration in supabase/migrations/*.sql; do
  echo "    $(basename "$migration")"
  run_sql "$migration"
done

echo "==> Seed"
run_sql supabase/seed.sql

echo "==> Schema rules"
run_sql supabase/test/schema_rules_test.sql

echo
echo "All migrations applied and schema rules hold."
