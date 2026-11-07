#!/usr/bin/env bash
# Offline regression tests. Uses a synthetic ZIP and mock Android tools only.
# No Android application is built, signed, installed, deployed or published.
set -euo pipefail
VERIFY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/android-apk-verify.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export ANDROID_SDK_ROOT="$WORK/android-sdk" JAVA_HOME="$WORK/java-17"
mkdir -p "$ANDROID_SDK_ROOT/build-tools/37.0.0" "$JAVA_HOME/bin"
TOOLS="$ANDROID_SDK_ROOT/build-tools/37.0.0"
cat > "$TOOLS/apksigner" <<'MOCK'
#!/usr/bin/env bash
case "${APK_TEST_SIGNER_MODE:-debug}" in
  debug) echo 'Signer #1 certificate DN: CN=Android Debug, O=Android, C=US' ;;
  release) echo 'Signer #1 certificate DN: CN=Release, O=Example' ;;
  lookalike) echo 'Signer #1 certificate DN: CN=Android Debug Impostor, O=Example' ;;
  error) exit 1 ;;
esac
MOCK
cat > "$TOOLS/aapt" <<'MOCK'
#!/usr/bin/env bash
printf "package: name='%s' versionCode='1' versionName='0.1.0'\n" "${APK_TEST_PACKAGE:-com.eazicart.mobile.dev}"
MOCK
cat > "$TOOLS/zipalign" <<'MOCK'
#!/usr/bin/env bash
[[ "${APK_TEST_ZIPALIGN_FAIL:-0}" != "1" ]]
MOCK
cat > "$JAVA_HOME/bin/java" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$TOOLS"/* "$JAVA_HOME/bin/java"
python3 - "$WORK/synthetic.apk" "$WORK/missing-manifest.apk" <<'PY'
import sys, zipfile
for path, valid in ((sys.argv[1], True), (sys.argv[2], False)):
    with zipfile.ZipFile(path, "w") as archive:
        if valid:
            archive.writestr("AndroidManifest.xml", "synthetic fixture only")
        archive.writestr("classes.dex", "synthetic bytes, not executable Android code")
PY
passed=0
expect_exit() {
  local expected="$1" label="$2"
  shift 2
  local code=0
  "$@" >"$WORK/out" 2>"$WORK/err" || code=$?
  if [[ "$code" -ne "$expected" ]]; then
    echo "FAIL $label: expected exit $expected, received $code" >&2
    cat "$WORK/out" "$WORK/err" >&2
    exit 1
  fi
  echo "PASS $label"
  passed=$((passed + 1))
}
expect_exit 0 'synthetic debug path' bash "$VERIFY" "$WORK/synthetic.apk"
grep -q 'VERIFIED: APK signature' "$WORK/out"
expect_exit 23 'reject release certificate' env APK_TEST_SIGNER_MODE=release bash "$VERIFY" "$WORK/synthetic.apk"
expect_exit 23 'reject debug-name lookalike certificate' env APK_TEST_SIGNER_MODE=lookalike bash "$VERIFY" "$WORK/synthetic.apk"
expect_exit 1 'reject signing verification failure' env APK_TEST_SIGNER_MODE=error bash "$VERIFY" "$WORK/synthetic.apk"
expect_exit 1 'reject zip alignment failure' env APK_TEST_ZIPALIGN_FAIL=1 bash "$VERIFY" "$WORK/synthetic.apk"
expect_exit 23 'reject package mismatch' env APK_TEST_PACKAGE=com.example.wrong bash "$VERIFY" "$WORK/synthetic.apk"
expect_exit 1 'reject missing manifest' bash "$VERIFY" "$WORK/missing-manifest.apk"
expect_exit 23 'reject missing APK' bash "$VERIFY" "$WORK/absent.apk"
if grep -Fq 'eazicart-qa-apk-signatures.txt' "$VERIFY"; then
  echo 'FAIL verifier still has a shared signature-output path' >&2
  exit 1
fi
echo "PASS $passed/$passed offline verifier cases (synthetic ZIP/mock tools; no real APK)"
