import { describe, expect, it } from "vitest";
import { safeNextPath } from "./navigation";

describe("post-login navigation", () => {
  it("preserves internal product destinations", () => {
    expect(safeNextPath("/product/demo?source=cart")).toBe(
      "/product/demo?source=cart",
    );
  });
  it.each([
    null,
    "https://example.com",
    "//example.com",
    "javascript:alert(1)",
  ])("rejects external or executable destinations: %s", (value) =>
    expect(safeNextPath(value)).toBe("/"),
  );
});
