# EaziCart

EaziCart is a scalable commerce platform being prepared as a TypeScript-first monorepo.

## Workspace

The repository is organized with pnpm workspaces and Turborepo:

- `apps/web` – the initial Next.js customer experience
- `packages/ui` – framework-compatible shared React components
- `packages/types` – shared domain contracts
- `packages/config` – shared TypeScript and lint configuration
- `packages/database` – an unconnected PostgreSQL configuration boundary

Seller, admin, mobile, API, worker, and infrastructure workspaces will be added
when those products begin. This keeps the foundation intentional rather than
shipping empty applications.

## Getting started

```bash
corepack enable
pnpm install
pnpm dev
```

The web application is then available at `http://localhost:3000`.

The API and web app run together with `pnpm dev`. Copy `apps/api/.env.example`
and `apps/web/.env.example` to their local `.env` files, then configure the
database and auth values. The browser uses `NEXT_PUBLIC_API_BASE_URL` (default
`http://localhost:3001`) and the API permits the single `WEB_ORIGIN` value
(default `http://localhost:3000`).

For this MVP only, access and rotating refresh tokens are centralized in the
web API client and persisted in browser local storage. This is not presented as
production-grade token storage; a production deployment should move refresh
credentials to secure, HTTP-only same-site cookies.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

## Status

The initial monorepo foundation and a minimal web landing screen are in place.

## Security

Production secrets, API keys, credentials, and environment-specific private values must never be committed to this repository.
