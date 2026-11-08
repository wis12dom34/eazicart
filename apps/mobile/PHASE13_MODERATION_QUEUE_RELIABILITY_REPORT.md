# EaziCart Native — Phase 13 Moderation Queue Reliability

Date: 2026-11-08. Development branch only, no deployment.

## Baseline
Phase 12 commit `3219b3b454fb16e3044c10e1b9794c792a00c4d7`.

## Improvements
- Added moderation reason filters (ALL, SPAM, SCAM, HARASSMENT, OTHER) in addition to existing status filters, using the existing server-side reason query and cursor pagination.
- Switching filters clears accumulated pages and the selected report audit panel, preventing mixed filters from showing stale records.
- Pull-to-refresh invalidates report and audit-history queries and resets accumulated pagination.
- Stale moderation transitions (HTTP 409) now clear old pages, refresh the queue and explain the conflict to the reviewer instead of treating it as an ordinary save error.
- Audit-history errors now offer manual retry; pagination does not offer Load more without a next cursor, and guards against a repeated cursor or active refetch.
- No automatic moderation, bans, timers, notifications, customer account changes or production API changes.

## Checks
- Native TypeScript passed.
- Native unit/API tests: 77/77 passed, including a new bearer-authenticated status + reason + cursor request test.
- Native ESLint passed, changed files formatted and Git whitespace check passed.
- No real device QA or Android APK/iOS IPA built. Earlier Phase 12 platform JS bundle verification remains the latest native bundle check.
