# EaziCart on a dedicated VPS

This deploys the existing Fastify API and Prisma migrations on Contabo or another
Linux VPS. The existing Next.js website connects to this same API, as will the
future iPhone app. No second backend, demo seed or n8n dependency is introduced.

## First deployment

Use a fresh Ubuntu VPS with Docker Engine and the Compose plugin installed from
Docker's official repository. Use a server with at least 4 vCPU and 8 GB RAM as
an initial configuration; establish actual capacity with load tests. This single
server setup is not highly available and does not automatically scale.

1. Check out the reviewed EaziCart release on the server.
2. Point the API domain's DNS A record at the VPS. Add an AAAA record only if IPv6
   is configured and reachable. Allow inbound TCP 80/443 and restrict SSH access.
   These ports must be available for Caddy; do not install alongside another
   reverse proxy already using them without adapting the configuration.
3. From the repository root, create the private environment file:

   ```bash
   cp infra/vps/.env.example infra/vps/.env
   chmod 600 infra/vps/.env
   openssl rand -hex 32
   openssl rand -hex 32
   ```

   Enter the two generated values separately for `POSTGRES_PASSWORD` and
   `JWT_SECRET`. Set `API_DOMAIN` to the hostname without a scheme or path,
   `ACME_EMAIL` to your certificate contact, and `WEB_ORIGIN` to the exact website
   HTTPS origin. The API currently accepts one browser origin.

4. Set `API_IMAGE` to a unique release tag and build the existing image:

   ```bash
   docker build -f Dockerfile.api -t eazicart-api:release-1 .
   docker compose --env-file infra/vps/.env -f infra/vps/compose.yaml config --quiet
   docker compose --env-file infra/vps/.env -f infra/vps/compose.yaml up -d
   docker compose --env-file infra/vps/.env -f infra/vps/compose.yaml ps -a
   docker compose --env-file infra/vps/.env -f infra/vps/compose.yaml logs migrate
   ```

   The migration container must exit successfully before the API starts; Caddy
   waits for the API health check. PostgreSQL and the API have no public port
   bindings. Caddy obtains and renews HTTPS certificates when DNS and network
   access are correct. Do not print expanded Compose configuration: it contains
   secrets.

5. Verify `https://YOUR_API_DOMAIN/ready`, registration, login and product reads.
   Set the website's `NEXT_PUBLIC_API_BASE_URL` to that HTTPS origin and rebuild
   the existing website. Never expose database or JWT secrets to the frontend.

## Updates and backups

Take a backup before migration. Keep a copy outside this VPS and test recovery
to a separate database. From the repository root:

```bash
mkdir -p backups
chmod 700 backups
umask 077
docker compose --env-file infra/vps/.env -f infra/vps/compose.yaml exec -T postgres pg_dump -U eazicart -d eazicart -Fc > backups/eazicart-before-release.dump
```

Check the command exit status before using the backup. Use a new backup filename
for each release. The dump contains private customer data; do not commit it.
Named volumes survive container recreation; `down -v` destroys them. Changing
`POSTGRES_PASSWORD` in the environment does not rotate an initialized database's
password.

Build a newly tagged API image, update `API_IMAGE`, then run `up -d` again. Check
migration logs and readiness after each release. An old API image is safe to
restore only if it remains compatible with the new database schema; migrations
are not automatically reversible. Schedule a maintenance window when a schema
change is incompatible with requests served by the previous API.

## Launch gates still outstanding

Payments and media uploads are intentionally not enabled by this baseline.
Configure and test Paystack separately before real checkout. Reel uploads require
persistent media storage and delivery; do not write them to disposable container
disk. Use object storage before spreading API instances across multiple servers.

Complete production session handling, account deletion, content reporting/blocking
and moderation, chat and real rider tracking before advertising those features.
See `docs/ios-release-requirements.md`. This deployment does not produce an iOS
binary or guarantee App Store approval.

Track CPU, available memory, disk usage, database latency and API error rates.
When load tests or production measurements justify it, move PostgreSQL to its own
host and add stateless API replicas behind a load balancer. Shared sessions,
rate limits, media storage and jobs must work across replicas first.
