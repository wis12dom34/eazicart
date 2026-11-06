#!/usr/bin/env bash
# Build a development-only APK on a sufficiently provisioned isolated machine.
# No deploy/publish/install operations, signing credentials, or production APIs.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/../.." && pwd)"
BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
if [[ "${EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD:-}" != "1" ]]; then
  echo "REFUSED: set EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD=1 for an authorized local development build" >&2
  exit 23
fi
if [[ "$BRANCH" != feat/* ]]; then
  echo "REFUSED: debug build requires a separate development branch (not production/main)" >&2
  exit 23
fi
if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" || -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "REFUSED: JAVA_HOME and ANDROID_SDK_ROOT must point to an installed local QA toolchain" >&2
  exit 23
fi
if [[ ! -d "$ANDROID_SDK_ROOT/platforms/android-37.0" || ! -d "$ANDROID_SDK_ROOT/build-tools/37.0.0" || ! -d "$ANDROID_SDK_ROOT/ndk/27.1.12297006" ]]; then
  echo "REFUSED: exact Expo native Android SDK 37 / Build Tools 37 / NDK 27 required" >&2
  exit 23
fi
if [[ -z "${GRADLE_USER_HOME:-}" || "$GRADLE_USER_HOME" == /root/.gradle ]]; then
  echo "REFUSED: Gradle must use a dedicated QA cache, never the shared system cache" >&2
  exit 23
fi
if [[ ! -f "$APP_ROOT/android/gradlew" ]]; then
  echo "REFUSED: run Expo Android prebuild in this isolated development worktree first" >&2
  exit 23
fi

disk_kib="$(df -Pk "$APP_ROOT" | awk 'NR==2{print $4}')"
mem_kib="$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)"
swap_kib="$(awk '/^SwapFree:/{print $2}' /proc/meminfo)"
# These limits deliberately reject the shared 8-GB Contabo production VPS.
if (( disk_kib < 16 * 1024 * 1024 || mem_kib < 6 * 1024 * 1024 || swap_kib < 2 * 1024 * 1024 )); then
  echo "REFUSED: need >=16 GiB free disk, >=6 GiB available RAM, >=2 GiB free swap. This is a safety guard for production VPS." >&2
  printf 'Available disk KiB: %s; RAM KiB: %s; swap KiB: %s\n' "$disk_kib" "$mem_kib" "$swap_kib" >&2
  exit 23
fi

# A development build must never silently fall back to https://eazicart.com/api.
# Mandatory before creating caches or touching Gradle project configuration.
node "$APP_ROOT/scripts/android-qa-api-preflight.mjs"

mkdir -p "$GRADLE_USER_HOME"
printf 'sdk.dir=%s\n' "$ANDROID_SDK_ROOT" > "$APP_ROOT/android/local.properties"
chmod 600 "$APP_ROOT/android/local.properties"
export PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"

cd "$APP_ROOT/android"
echo "Building isolated EaziCart Android ARM64 debug APK (no release signing)."
./gradlew --no-daemon --max-workers=1 --console=plain \
  -Dorg.gradle.jvmargs="-Xmx1536m -XX:MaxMetaspaceSize=512m" \
  -Pkotlin.compiler.execution.strategy=in-process \
  -PreactNativeArchitectures=arm64-v8a \
  :app:assembleDebug
echo "Debug APK output (not installed, uploaded or published):"
find app/build/outputs/apk/debug -maxdepth 1 -name '*.apk' -printf '%f %s bytes\n'
APK="$PWD/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "FAILED: Gradle returned successfully but no expected debug APK exists" >&2
  exit 1
fi
"$APP_ROOT/scripts/android-apk-verify.sh" "$APK"
