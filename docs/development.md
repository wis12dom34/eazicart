# Run the PostgreSQL-backed MVP

Use Node.js 20.19+ and pnpm 10.28.1, with Docker Compose v2 available.
Run these commands from the repository root on a development machine:

```bash
pnpm install --frozen-lockfile=false
pnpm setup:dev
pnpm db:up
pnpm --filter @eazicart/database prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. The API listens at http://localhost:3001.
Register your own customer account in the app. Demo sellers have randomly
hashed, undisclosed passwords; there are no shared demo credentials.

The seed adds three categories, two sellers, four products and local demo
illustrations. Re-running it preserves existing records and does not reset
stock, overwrite products, delete users or create orders. Prices are demo
catalog values. This command refuses production mode and requires
`ALLOW_DEMO_SEED=true`. Use it only with a dedicated development database.

## Environment configuration

`pnpm setup:dev` generates random local database and signing credentials.
It creates the root `.env`, `apps/api/.env`, `apps/web/.env` and
`packages/database/.env` with private file permissions. Existing files are
never overwritten. Keep values consistent when editing them later.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Root Docker Compose | Local PostgreSQL password |
| `DATABASE_URL` | API and database package | PostgreSQL connection string |
| `JWT_SECRET` | API | Random signing secret, at least 32 characters |
| `WEB_ORIGIN` | API | Exact allowed web origin, normally `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | Web | Browser-visible API origin, normally `http://localhost:3001` |
| `ALLOW_DEMO_SEED` | Database seed | Explicit development-only seed opt-in |
| `HOST` / `PORT` | API | Defaults: `0.0.0.0` / `3001` |
| `ACCESS_TOKEN_TTL` | API | Defaults to `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | API | Defaults to `30` |
| `NODE_ENV` | Runtime | Development, test or production |

The API loads its local `.env` before parsing configuration. Prisma loads
`packages/database/.env`; Next.js loads `apps/web/.env`. Existing environment
variables take precedence. Turbo forwards server configuration, and the web
build cache includes `NEXT_PUBLIC_API_BASE_URL`. Rebuild the web app after
changing its public API origin. Never put secrets in `NEXT_PUBLIC_*` variables.

PostgreSQL binds only to `127.0.0.1:5432` and uses a persistent Docker volume.
`docker compose stop postgres` stops it without deleting data. Do not use
`docker compose down -v` unless intentionally discarding the development DB.

## Migrations and existing databases

Fresh databases run the new initial migration followed by the unchanged
Phase 2 migration. No reset or `db push` is needed. CI checks that applying
these migrations produces exactly the current Prisma schema.

For a pre-existing database created with `db push`, do not blindly apply the
initial migration. Back up and inspect its schema and `_prisma_migrations`
first. Only after verifying that a migration's changes already exist should
an operator mark that migration as applied with `prisma migrate resolve`.
Never reset a populated database to make migration history match.

## Production-build validation

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Stop any existing web/API processes before the browser tests. They start the
compiled API and production Next.js server themselves. Use the seeded
**development database**: these tests create unique customer accounts and
unpaid orders. They verify login, refresh, catalog, follows, saved products,
cart, addresses, trusted totals, order ownership, notifications and profile
persistence. CI uses an isolated PostgreSQL service, applies migrations and
seeds twice before running the same checks. Browser tests do not contact a
payment provider. Screenshots on failure exclude session tokens.

For a manual production-build check, run `pnpm build`, then start
`pnpm --filter @eazicart/api start` and `pnpm --filter @eazicart/web start`
in separate terminals. This is a local runtime check, not a deployment.

## MVP boundaries

Checkout creates `PENDING` unpaid orders from server-side product prices.
Order creation clears the cart and creates a customer notification in one
transaction. No payment is requested, processed or marked successful.
Inventory reservation and payment reconciliation remain a later phase.
Reels and Payment Methods remain placeholders. Refresh credentials still
use the existing browser local-storage MVP design; cookie-based session
hardening is a separate production milestone.
