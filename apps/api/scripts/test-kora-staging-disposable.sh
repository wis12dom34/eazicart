#!/usr/bin/env bash
# Run ONLY within `pg_virtualenv -t`. No production DB access.
set -euo pipefail
cd "$(dirname "$0")/../../.."
if [[ "${EAZICART_IDEM_DISPOSABLE:-}" != "1" || "${NODE_ENV:-}" != "test" || "${EAZICART_KORA_FIXTURE_ONLY:-}" != "1" ]]; then
  echo 'REFUSED: disposable-only test flags missing' >&2
  exit 23
fi
if [[ ! "${PGPORT:-}" =~ ^[0-9]+$ || "${PGPORT:-}" == "5432" || "${PGHOST:-}" != "localhost" || "${PGUSER:-}" != "postgres" ]]; then
  echo 'REFUSED: unknown PostgreSQL cluster' >&2
  exit 23
fi
# Server-reported data directory is not the default/production PostgreSQL cluster.
directory="$(psql -X -w -At -d postgres -c 'SHOW data_directory')"
if [[ ! "$directory" == /tmp/pg_virtualenv.* ]]; then
  echo 'REFUSED: database is not a temporary pg_virtualenv cluster' >&2
  exit 23
fi
# Root is the local process owner; create a root-only ephemeral role under
# the already verified temp cluster, using socket peer authentication.
psql -X -w -v ON_ERROR_STOP=1 -d postgres -c 'CREATE ROLE root LOGIN SUPERUSER'
export DATABASE_URL="postgresql://root@localhost:${PGPORT}/postgres?schema=public&host=/var/run/postgresql"
echo "Validated disposable PostgreSQL cluster under /tmp, port ${PGPORT}"
pnpm --filter @eazicart/database exec prisma db push --skip-generate
# Exercise the exact additive review migration on the disposable cluster:
# db push created the full schema, then we remove only our new empty table,
# and apply the SQL migration unchanged.
psql -X -w -v ON_ERROR_STOP=1 -d postgres -c 'DROP TABLE "OrderIdempotency"'
psql -X -w -v ON_ERROR_STOP=1 -d postgres -f packages/database/prisma/migrations/20261106000000_order_idempotency/migration.sql
psql -X -w -v ON_ERROR_STOP=1 -d postgres -c 'DROP TABLE "KoraCheckoutAttempt"'
psql -X -w -v ON_ERROR_STOP=1 -d postgres -f packages/database/prisma/migrations/20261106001000_kora_checkout_initiation_claim/migration.sql
# Isolate suite-level failure-injection triggers; individual tests still
# execute their own parallel webhook/order requests inside each suite.
pnpm --filter @eazicart/api exec vitest run --no-file-parallelism \
  src/modules/orders/idempotent-preview.postgres.test.ts \
  src/modules/payments/isolated-kora-staging.postgres.test.ts
echo 'PASS: synthetic KoraPay end-to-end staging integration and settlement tests'
