# Deploy the existing EaziCart API

The API already contains accounts, products, categories, cart, addresses, saved
products, follows, orders, Paystack payments, notifications, Reels and seller
management. These services reuse the existing Prisma schema and migrations.
This deployment setup does not create a second backend or seed demo customers.

## Required hosting configuration

Use a Node.js/container host and a PostgreSQL database. Set these values privately
on the API host:

| Variable       | Value                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| `NODE_ENV`     | `production`                                                                           |
| `DATABASE_URL` | The PostgreSQL connection URL, including the database provider's required TLS settings |
| `JWT_SECRET`   | A randomly generated secret of at least 32 characters                                  |
| `WEB_ORIGIN`   | The exact HTTPS customer app origin; no trailing slash                                 |
| `PORT`         | The host's assigned port, or `3001`                                                    |
| `HOST`         | `0.0.0.0`                                                                              |

Set `PAYSTACK_SECRET_KEY` before enabling real checkout payments. Video uploads
also need persistent storage with `REEL_MEDIA_DIRECTORY` and a matching public
`REEL_MEDIA_BASE_URL`; ephemeral container disk is unsuitable for uploaded media.
Do not put secrets in `NEXT_PUBLIC_*` variables.

## Build, migrate, and start

From the repository root on a Node.js host with pnpm 10.28.1:

```bash
pnpm install --frozen-lockfile --filter @eazicart/api...
pnpm --filter @eazicart/database build
pnpm --filter @eazicart/api build
pnpm --filter @eazicart/database prisma:deploy
pnpm --filter @eazicart/api start
```

The host must inject `DATABASE_URL` for the migration command and all required
variables for startup. Do not run the development seed on a live database.
Apply migrations once as a release step, before starting the new API version.
Inspect migration output before directing customer traffic to it.

Alternatively, build `Dockerfile.api` from the repository root and inject the
same environment variables at runtime. Run migrations separately using the same
release image's Prisma CLI:

```bash
docker build -f Dockerfile.api -t eazicart-api .
docker run --rm --env-file /secure/path/eazicart-api.env --workdir /app/packages/database eazicart-api node node_modules/prisma/build/index.js migrate deploy
docker run --env-file /secure/path/eazicart-api.env -p 127.0.0.1:3001:3001 eazicart-api
```

Terminate HTTPS at the host's ingress or reverse proxy. The localhost port binding
above is for a reverse proxy on the same machine.

## Connect the customer app

Set `NEXT_PUBLIC_API_BASE_URL` on the existing Vercel project to the deployed API's
HTTPS origin, then rebuild the customer app. `WEB_ORIGIN` must match the browser
origin used for that deployment. The current CORS policy allows one exact origin;
use a stable customer app URL instead of changing preview URLs.

`GET /health` checks process liveness. `GET /ready` checks PostgreSQL and returns
503 when it is unavailable; configure the host's readiness check to use `/ready`.
Startup verifies the database connection. SIGTERM/SIGINT drain requests and close
the database connection with a ten-second shutdown deadline.

Before launch, verify registration/login, products, cart and order creation
against the deployed database. Use Paystack test mode to verify the payment
callback before enabling live payments. The current customer session client
stores tokens in local storage; migration to HTTP-only refresh cookies remains
a production authentication task. Chat and real rider tracking also need their
own backend work. A successful deployment is not a claim that those flows exist.
