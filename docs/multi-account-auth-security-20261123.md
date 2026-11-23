# Multi-account authentication — implementation and security gates

Status: design checkpoint only. **Not implemented or enabled on this GitHub branch.** Do not deploy.

## Confirmed repository baseline
- `apps/api/src/modules/auth/index.ts` uses one `eazicart_refresh` HttpOnly cookie, rotates it on refresh, and accepts bearer access JWTs via `app.authenticate`.
- `app.authenticate` verifies the JWT signature and subject but does not check a browser-device session, active-account generation, or independent account revocation.
- Existing login, registration, refresh, and logout behavior must remain compatible until a tested migration is available.

## Required backend contract
1. Store browser-device credential only in a Secure, HttpOnly, host-only cookie; hash it in PostgreSQL. Determine actual web/API origin and reverse-proxy topology before selecting `__Host-` cookie and same-origin routing.
2. Persist device-to-user account associations and independently revocable sessions in PostgreSQL; never place refresh tokens in localStorage or return them to browser JavaScript.
3. Make account addition require fresh password verification. Account list returns only public profile fields and active account; never token hashes.
4. Make switch atomic: validate selected session, increment device session generation, and issue a new access credential bound to device ID, selected account, and generation. A failed switch must not mutate active selection.
5. All protected API routes must reject a bearer token whose device session has been revoked, whose account differs from active account, or whose generation is stale. This requires updating the shared `authenticate` guard, not merely adding account routes.
6. Refresh must be server-side, single-use, atomic and bound to the selected account; replay must fail. Independent logout must revoke only that account. Logout-all revokes all associated sessions and rotates/invalidates device credential.
7. Cookie-mutating endpoints require strict Origin/Fetch Metadata validation and appropriate CSRF protections. Rate-limit login, account-add and switching.
8. Avoid returning `503` after mutating active account or storing a new session. Reject incomplete flows before mutation.

## Required frontend contract
- Accounts sheet lists verified saved accounts, active account, and explicit add/remove/logout actions.
- On switch: cancel in-flight requests, increment client identity epoch, clear all account-scoped caches, switch credentials, then fetch the new account's data.
- Cross-tab coordination must invalidate stale requests; after Safari restart the server-side sessions remain available until expiry/revocation.
- Never invent unread counts or subscription badges.

## Release gates
- Disposable PostgreSQL migration and rollback rehearsal; concurrency and replay tests; independent revocation; device expiry; CSRF and XSS review.
- Browser tests for iPhone Safari, reload/restart, add/switch/remove, multiple tabs, and no cross-account data leakage.
- Isolated private HTTPS preview with test identities; verify no production database or payments are connected.
- Explicit user approval before merging or deploying.

## Existing VPS-only candidate (not present in GitHub)
The user previously developed a candidate at `/opt/eazicart/candidates/eazicart-multi-account-auth-20261123`. Prior remote checks reported 16 passing focused tests and disposable PostgreSQL persistence checks. Those are **not GitHub CI results**, and their source changes have not been imported into this branch. Do not claim the feature is implemented from this document.
