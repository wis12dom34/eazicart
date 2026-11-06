# EaziCart Native — Dedicated Android Runner Enrollment Readiness

Date: 2026-11-06
Status: **Prepared only — no runner created, registered, or activated. No CI build dispatched.**

## Changes

- The manual workflow validates the exact maintainer-approved 40-character `GITHUB_SHA` **in its first authorization step, before checking out repository contents**. This is defense in depth; the runner itself must still be trusted and isolated.
- The existing Android runner readiness script now rejects known co-hosted project directories (WickSpend, PrimeSocialHub, PulseLoop and RickVerify), in addition to the EaziCart production application and services. These checks are intentionally conservative and do not replace virtualization/host attestation.
- The runner policy tests now exercise the co-hosted workload refusal.

## Dedicated machine enrollment checklist (operator runbook, not executable by this review branch)

1. Obtain explicit approval for a **new isolated VM**. Do not use either currently connected VPS. Suggested initial machine: Ubuntu Linux, x86_64, 16 GiB RAM or more, at least 50 GiB free SSD disk, and 4 GiB swap or more; no access to production DB, SSH keys, wallets, web deployments or payment secrets.
2. Create a dedicated unprivileged `eazicart-android-qa` account. Avoid broad sudo, persistent privileged Docker sockets, shared production mounts and public-facing services. Restrict filesystem access and outbound traffic according to organization policy.
3. Install JDK 21, Node 22, pnpm 10.28.1, and the exact Android SDK package versions required by Expo: Platform 37, Build Tools 37.0.0 and NDK 27.1.12297006. Configure `JAVA_HOME`, `ANDROID_SDK_ROOT`, and a dedicated `GRADLE_USER_HOME` for the unprivileged account.
4. Verify the machine is isolated using `node apps/mobile/scripts/android-runner-readiness.mjs` from a reviewed source checkout; this should refuse missing explicit approval, insufficient resources, wrong toolchain, root, and known production workloads. Use `EAZICART_ANDROID_QA_ISOLATED_RUNNER=1` only on a genuinely separate, approved machine.
5. In the repository's GitHub Settings → Actions → Runners, create the dedicated runner using **the one-time registration token issued by GitHub** (never put the token in code, logs, messages or environment variables inside the app). Choose the restricted runner group and label `eazicart-android-qa`. Prefer ephemeral, single-job runner lifecycles; securely delete/rotate after each build. An operator must verify GitHub's current documented enrollment commands and security recommendations.
6. In repository Actions variables, configure `EAZICART_ANDROID_QA_ALLOWED_API_HOST` to the exact approved isolated staging hostname and `EAZICART_ANDROID_QA_APPROVED_SHA` to the exact reviewed commit. This SHA must be refreshed under a separate review for any subsequent source revision.
7. The manual workflow is currently only on a review branch; it is **not activated on the default branch**. Obtain explicit approval before merging/enabling it, registering a runner, or dispatching it. The dispatch requires `BUILD_DEBUG_ONLY` and an approved staging HTTPS API URL ending in `/api`. No KoraPay live secrets or customer data may reach this machine.
8. After a separately approved build, inspect the APK's package ID, signature, alignment and SHA-256 with `apps/mobile/scripts/android-apk-verify.sh`. Then obtain separate authorization for internal APK transfer/install and actual Android device QA. There is no publishing or automatic upload step.

## Verification performed

- Workflow structure: first authorization step contains a maintainer-controlled SHA comparison prior to `actions/checkout`; manual trigger only, read-only contents permission, isolated self-hosted runner label, no artifact upload.
- Runner readiness unit tests: **5/5 passed**, including rejection of other production workloads.
- Existing 50 mobile regression tests and 6 staging security tests will be rerun before GitHub publication; the branch changes no mobile UI or backend behavior.
- Both currently connected VPS devices remain unsuitable for runner enrollment due to production workloads and/or inadequate resources.

## Explicitly not done

- No cloud VM creation, runner enrollment token request, GitHub runner registration, workflow dispatch, APK creation or upload, staging/public network exposure, database migration, payment modification, or deployment.
