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

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

## Status

The initial monorepo foundation and a minimal web landing screen are in place.
The current Figma implementation audit and design-access prerequisite are
documented in [`docs/figma-implementation-audit.md`](docs/figma-implementation-audit.md).

## Security

Production secrets, API keys, credentials, and environment-specific private values must never be committed to this repository.
