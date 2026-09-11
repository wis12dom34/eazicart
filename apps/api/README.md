# EaziCart API

Phase 1 is a Fastify/TypeScript foundation. Runtime persistence uses PostgreSQL through the shared `@eazicart/database` Prisma boundary; tests inject an isolated in-memory authentication store.

## Routes

- `GET /health`
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `GET /users/me` (bearer access token required)
- `GET /categories`, `GET /products`
- Authenticated collection foundations: `GET /seller-profiles`, `/cart`, `/orders`, `/addresses`, `/saved-products`, `/follows`, and `/notifications`

Copy `.env.example` to `.env`, set private values, generate the Prisma client, and run database migrations before starting the API. Refresh tokens are opaque random values; only their SHA-256 hashes are persisted. Passwords are hashed with Argon2id by the `argon2` package.

Email, SMS, payments, object storage, logistics, Redis, and background queues are intentionally deferred. The resource collection endpoints are deliberately empty foundations for later business phases; no third-party provider is contacted.
