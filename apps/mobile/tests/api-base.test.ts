import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMobileApiBaseUrl } from "../src/lib/api-base";

test("requires an explicit API URL instead of silently contacting production", () => {
  for (const raw of [undefined, "", "  ", " https://qa.example.test/api"]) {
    assert.throws(() => resolveMobileApiBaseUrl(raw), /API is not configured/);
  }
});

test("accepts an explicit secure API and local development API", () => {
  assert.equal(
    resolveMobileApiBaseUrl("https://qa.example.test/api"),
    "https://qa.example.test/api",
  );
  assert.equal(
    resolveMobileApiBaseUrl("http://localhost:3000/api"),
    "http://localhost:3000/api",
  );
});

test("rejects non-API paths, insecure public URLs, credentials and URL parameters", () => {
  for (const raw of [
    "http://qa.example.test/api",
    "http://127.0.0.1:3000/api",
    "ftp://qa.example.test/api",
    "https://qa.example.test",
    "https://qa.example.test/api/",
    "https://qa.example.test/v1",
    "https://user:pass@qa.example.test/api",
    "https://qa.example.test/api?token=secret",
    "https://qa.example.test/api#fragment",
    "not a URL",
  ]) {
    assert.throws(() => resolveMobileApiBaseUrl(raw), { name: "Error" }, raw);
  }
});
