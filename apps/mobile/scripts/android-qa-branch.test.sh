#!/usr/bin/env bash
# Only exercises fail-closed validation. Never reaches Gradle.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/android-debug-qa.sh"
export EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD=1

reject_ref() {
  local name="$1" ref="$2" kind="${3:-branch}" output status
  set +e
  output="$(env GITHUB_ACTIONS=true GITHUB_REF_TYPE="$kind" GITHUB_REF_NAME="$name" GITHUB_REF="$ref" bash "$SCRIPT" 2>&1)"
  status=$?
  set -e
  if [[ "$status" != 23 || "$output" != *"GitHub Actions must be manually dispatched"* ]]; then
    echo "FAILED: rejected GitHub ref was not refused before reaching toolchain" >&2
    exit 1
  fi
}
reject_ref main refs/heads/main
reject_ref feat/qa refs/heads/main
reject_ref feat/qa refs/tags/feat/qa tag
reject_ref feat/qa refs/heads/other-feature

set +e
ok_output="$(env -u JAVA_HOME -u ANDROID_SDK_ROOT GITHUB_ACTIONS=true GITHUB_REF_TYPE=branch GITHUB_REF_NAME=feat/qa GITHUB_REF=refs/heads/feat/qa bash "$SCRIPT" 2>&1)"
ok_status=$?
set -e
if [[ "$ok_status" != 23 || "$ok_output" != *"JAVA_HOME and ANDROID_SDK_ROOT"* ]]; then
  echo "FAILED: valid detached Actions branch must reach the toolchain guard" >&2
  exit 1
fi
echo "PASS: main, spoofed refs and tags fail closed; valid feature ref proceeds to toolchain safety checks"
