#!/usr/bin/env bash
# Spins up a throwaway local PostgreSQL 16, applies Supabase stubs + all migrations,
# then runs the SQL test files in supabase/tests (01_*.sql and later).
# Usage: npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PGPORT_TEST:-54329}"
DATA="$(mktemp -d /tmp/svoja360-pg-XXXX)"
RUNAS=""
if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; chown postgres "$DATA"; fi

cleanup() { $RUNAS "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

$RUNAS "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null

PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
if [ "${WITH_SEED:-1}" = "1" ] && [ -f "$ROOT/supabase/seed.sql" ]; then
  echo "seed: seed.sql"
  "${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
fi

status=0
for f in "$ROOT"/supabase/tests/[0-9][0-9]_*.sql; do
  case "$(basename "$f")" in 00_*) continue ;; esac
  echo "test: $(basename "$f")"
  if ! "${PSQL[@]}" -f "$f"; then status=1; fi
done

if [ "$status" = "0" ]; then echo "ALL DATABASE TESTS PASSED"; else echo "DATABASE TESTS FAILED"; fi
exit $status
