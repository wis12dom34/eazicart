#!/usr/bin/env bash
# Verify an already-built Android DEBUG APK. Never install, sign or publish.
set -euo pipefail
if [[ "$#" -ne 1 || ! -f "$1" ]]; then
  echo "REFUSED: supply an existing local Android debug APK" >&2
  exit 23
fi
APK="$(realpath -- "$1")"
if [[ "$APK" != *.apk || ! -r "$APK" ]]; then
  echo "REFUSED: expected a readable .apk file" >&2
  exit 23
fi
if [[ -z "${ANDROID_SDK_ROOT:-}" || -z "${JAVA_HOME:-}" ]]; then
  echo "REFUSED: explicit Android SDK and JDK paths required" >&2
  exit 23
fi
BUILDTOOLS="$ANDROID_SDK_ROOT/build-tools/37.0.0"
if [[ ! -x "$BUILDTOOLS/apksigner" || ! -x "$BUILDTOOLS/aapt" || ! -x "$BUILDTOOLS/zipalign" || ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "REFUSED: verified Android Build Tools 37 and Java must be installed" >&2
  exit 23
fi
# Analyze the archive before invoking any Android binaries.
python3 - "$APK" <<'PY'
import pathlib, sys, zipfile
apk = pathlib.Path(sys.argv[1])
if apk.stat().st_size > 500 * 1024 * 1024 or apk.stat().st_size < 128:
    raise SystemExit("REFUSED: unexpected APK size")
with zipfile.ZipFile(apk) as archive:
    names = set(archive.namelist())
    if archive.testzip() is not None or "AndroidManifest.xml" not in names or not any(
        name.startswith("classes") and name.endswith(".dex") for name in names
    ):
        raise SystemExit("REFUSED: corrupt or incomplete Android APK")
PY
export PATH="$JAVA_HOME/bin:$PATH"
if ! "$BUILDTOOLS/zipalign" -c -p 4 "$APK" >/dev/null 2>&1; then
  echo "FAILED: APK alignment verification" >&2
  exit 1
fi
# Keep certificate metadata in memory. A fixed name in shared /tmp can be
# pre-created as a symlink and must never be used on a build runner.
if ! SIGNATURE_OUTPUT="$("$BUILDTOOLS/apksigner" verify --verbose --print-certs "$APK" 2>&1)"; then
  echo "FAILED: Android APK signature verification" >&2
  exit 1
fi
if ! grep -Eq '^Signer #1 certificate DN: .*CN=Android Debug(,|$)' <<<"$SIGNATURE_OUTPUT"; then
  echo "REFUSED: this verification workflow accepts only a standard Android debug certificate" >&2
  exit 23
fi
BADGING="$("$BUILDTOOLS/aapt" dump badging "$APK")"
if ! grep -Eq "^package: name='com\.eazicart\.mobile\.dev' " <<<"$BADGING"; then
  echo "REFUSED: unexpected Android package name" >&2
  exit 23
fi
printf '%s\n' "VERIFIED: APK signature, debug signer, zip alignment, archive, package ID"
sha256sum "$APK"
stat -c 'SIZE_BYTES=%s' "$APK"
echo "This local debug APK was NOT installed, uploaded, deployed or published."
