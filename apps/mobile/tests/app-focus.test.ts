import assert from "node:assert/strict";
import { test } from "node:test";
import { isNativeAppFocused } from "../src/lib/app-focus";

test("only foreground native state is focused", () => {
  assert.equal(isNativeAppFocused("active"), true);
  assert.equal(isNativeAppFocused("inactive"), false);
  assert.equal(isNativeAppFocused("background"), false);
  assert.equal(isNativeAppFocused("unknown"), false);
  assert.equal(isNativeAppFocused("extension"), false);
});
