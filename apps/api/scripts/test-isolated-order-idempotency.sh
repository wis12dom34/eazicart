#!/usr/bin/env bash
# This script deliberately runs ONLY against a new, throwaway pg_virtualenv
# Postgres cluster, never production. The cluster is deleted on exit.
set -euo pipefail
cd "$(dirname "$0")/../../.."
if [[ "${EAZICART_IDP_DISPOSABLE_LAUNCHED:-}" != "1" ]]; then
  exec env -u DATABASE_URL EAZICART_IDP_DISPOSABLE_LAUNCHED=1 pg_virtualenv -t bash "$0"
fi
if [[ "${PGHOST:-}" != "localhost" || "${PGUSER:-}" != "postgres" ||
      -z "${PGPORT:-}" || "${PGPORT}" == "5432" ||
      ! "${PGPORT}" =~ ^[0-9]+$ ]]; then
  echo "Refusing non-disposable PostgreSQL connection" >&2
  exit 2
fi
# The port must be owned by a temporary pg_virtualenv cluster, never a
# persistent PostgreSQL cluster that happens to listen on another port.
if ! pg_lsclusters -h | awk -v port="${PGPORT}" '
  $2 == "regress" && $3 == port && $4 == "online" &&
  $6 ~ /^\/tmp\/pg_virtualenv\./ { found = 1 }
  END { exit !found }
'; then
  echo "Refusing database that is not the disposable pg_virtualenv cluster" >&2
  exit 2
fi
export NODE_ENV=test
export EAZICART_DISPOSABLE_ORDER_TEST=1
if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "Disposable cluster must provide its own password" >&2
  exit 2
fi
# Dynamic throwaway credential only. Never print it or persist it in a file.
export DATABASE_URL="$(node -e 'const u=new URL("postgresql://postgres@localhost:"+process.env.PGPORT+"/postgres?schema=public");u.password=process.env.PGPASSWORD;process.stdout.write(u.toString())')"

echo "TEMPORARY DATABASE: localhost:${PGPORT}/postgres (pg_virtualenv -t)"
pnpm --filter @eazicart/database exec prisma migrate deploy
pnpm --filter @eazicart/api exec vitest run src/modules/orders/idempotent-candidate.postgres.test.ts
