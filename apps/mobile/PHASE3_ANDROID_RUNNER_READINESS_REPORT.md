# EaziCart Native — Dedicated Android Runner Readiness

Date: 2026-11-06
Status: **Review-only milestone. No runner registered, CI workflow activated or build triggered.**

## Implemented

- `apps/mobile/scripts/android-runner-readiness.mjs`: read-only, fail-closed machine inspection before dependency install or Gradle. Requires a Linux machine, unprivileged user, explicit isolated-runner authorization, absence of EaziCart production source and running web/API services, >=16 GiB free disk, >=6 GiB available RAM, >=2 GiB free swap, JDK 21, Android API 37 / Build Tools 37 / NDK 27.1.12297006 and a dedicated Gradle cache.
- GitHub Actions executions additionally require an exact 40-character `GITHUB_SHA` match against maintainer-managed Actions variable `EAZICART_ANDROID_QA_APPROVED_SHA`, plus an approved `feat/` branch. This is a code-level defense in depth; the runner must still be restricted to trusted authorized code.
- The existing manual workflow executes runner readiness and its tests **before `pnpm install`**. The existing local debug-build script repeats the readiness gate before creating caches or invoking Gradle. The manual workflow retains `workflow_dispatch` only, read-only repository permissions, no artifact upload/publish, and the dedicated `eazicart-android-qa` runner label.
- Five unit tests in `apps/mobile/scripts/android-runner-readiness.test.mjs`: approved isolated machine, production/root/authorization refusal, resource/toolchain/cache refusal, SHA/ref refusal, local isolated mode.

## Verification

- Runner readiness unit tests: **5/5 passed**.
- On the connected production VPS the read-only check **refused** the environment because it uses root, hosts live EaziCart processes and source, lacks required free disk/swap and explicit runner authorization. This is expected.
- YAML validated: read-only permissions, manual-only event, pinned SHA, dedicated runner label, readiness before dependencies, and no APK upload.
- Existing mobile and staging-security tests will be rerun as final regression gates.
- No Android APK created, no CI runner registered, no GitHub Actions workflow dispatched, no server migration, no deployment and no payment change.

## Dedicated runner provisioning checklist

1. **Require authorization** before creating or enrolling an external or self-hosted runner. Use a separate VM with an unprivileged service account and no production credentials, source trees or workload. Do not enroll either currently connected EaziCart/other-production VPS.
2. Install Java 21, Android SDK API 37, Build Tools 37, NDK 27.1.12297006, Node 22 and pnpm. Allocate at least 16 GiB available disk, 6 GiB available RAM and 2 GiB free swap; 16 GiB+ physical RAM with more disk headroom is preferred for Gradle builds.
3. Protect the runner with ephemeral clean workspaces, no shared production mounts, egress controls, and a dedicated runner group/label accessible only to trusted maintainers. Avoid exposing a persistent runner to untrusted pull requests.
4. Configure maintainer-controlled GitHub Actions variables `EAZICART_ANDROID_QA_ALLOWED_API_HOST` and `EAZICART_ANDROID_QA_APPROVED_SHA`. The latter must match the exact reviewed source commit to build. Configure an isolated HTTPS staging API ending in `/api`; do not use production accounts, credentials or KoraPay live keys.
5. Obtain separate explicit approval to activate the manual workflow on the default branch and dispatch it against the reviewed feature branch. The build runs only in a purpose-built nonproduction runner, with no artifact upload or store publication.
6. After a valid APK is built, verify signature/package/checksum and perform Android emulator or authorized device tests. Do not claim device validation until it occurs.

## Blockers

- The GitHub connector cannot retrieve private runner inventory/runner groups through its public-repository fetch action. No dedicated `eazicart-android-qa` runner was confirmed.
- No separate suitable runner is connected at this time; both online VPS machines host other workloads or have insufficient safe resources.
- This is only a review branch; the workflow is not active on the default branch. Approval is required for activation and build execution.
