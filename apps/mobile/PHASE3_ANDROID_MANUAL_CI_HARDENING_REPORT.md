# EaziCart Native — Android Manual CI Hardening

Date: 2026-11-06
Status: **Review-only development branch. Not merged, activated, dispatched, or deployed.**

## Audit findings fixed

1. **Detached HEAD GitHub checkout**: the original build script insisted on `git branch --show-current`, which is normally empty after GitHub Actions checkout. The debug script now accepts `GITHUB_ACTIONS=true` only when `GITHUB_REF_TYPE=branch`, `GITHUB_REF_NAME` begins with `feat/`, and `GITHUB_REF` exactly matches `refs/heads/${GITHUB_REF_NAME}`. Local development runs retain the prior named feature-branch check. Ref spoofing, tags, and main fail closed before launching Gradle.
2. **Untrusted staging hostname input**: the original dispatch form accepted both staging URL and approved hostname, allowing the operator to choose any hostname not excluded by blocklists. The approved host is now read from the maintainer-managed repository Actions variable `EAZICART_ANDROID_QA_ALLOWED_API_HOST`. A missing value prevents the job from proceeding. The operator may only provide the URL; the existing preflight must match its hostname exactly against the trusted repo variable.
3. **Regression coverage**: new `apps/mobile/scripts/android-qa-branch.test.sh` verifies that main, forged refs, and tags fail before build tools, while a consistent feature branch reaches the normal toolchain guard. This test is included as a separate step in the manual workflow, along with the existing 6 staging API tests.

## Verified checks

- Manual-only YAML trigger, read-only GitHub permissions, isolated runner label, no upload/publish/deploy steps: **passed**.
- Manual-branch regression test: **passed** (4 invalid refs rejected and valid feature ref reached toolchain refusal).
- Shell syntax validation: **passed**.
- Previously verified project mobile tests: 50/50 passed. The new changes do not alter any mobile product feature or payment logic.
- No real build, APK, VM provisioning, GitHub Actions dispatch, KoraPay sandbox transaction, production migration or deployment was executed.

## Remaining activation requirements

- This workflow remains on a **review branch**; per GitHub documentation, `workflow_dispatch` must be present on the default branch for manual triggering. Activation/merge requires explicit user approval.
- The repository's actual authorized Actions runner inventory and public/private visibility were not readable through the available GitHub connector. Do **not** assume that a runner with label `eazicart-android-qa` exists.
- Provision a **dedicated, ephemeral, access-restricted Android build runner**, never the production VPS. GitHub warns that self-hosted runners can persistently retain malicious code when executing untrusted branches; consider a dedicated restricted runner group and maintainer review before activating.
- Configure the trusted Actions variable `EAZICART_ANDROID_QA_ALLOWED_API_HOST` through repository settings by an authorized maintainer, and an approved isolated HTTPS staging backend.
- User approval remains required before any workflow merge/dispatch or cloud/self-hosted build execution, APK export, device installation or production feature activation.

## Preservation

- Production web/API, databases, wallets, customers, storefronts, KoraPay payment behavior, and live builds untouched.
- No APK generated, no download/link available, and no mobile app published.

Official references: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow and https://docs.github.com/en/actions/reference/security/secure-use
