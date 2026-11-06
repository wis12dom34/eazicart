import { describe, expect, it } from "vitest";
import {
  decodeReconciliationCursor,
  encodeReconciliationCursor,
  reconciliationColumns,
  reconcileCsv,
  safeCsvCell,
} from "./korapay-reconciliation-csv.js";

describe("read-only reconciliation CSV safeguards", () => {
  it("emits only the allowlisted ten fields", () => {
    const csv = reconcileCsv([
      {
        paymentId: "payment-1",
        orderId: "order-1",
        reference: "EC-12345678",
        initiationState: "UNKNOWN",
        paymentStatus: "PENDING",
        currency: "NGN",
        referenceMatches: true,
        createdAt: new Date("2026-11-06T00:00:00Z"),
        updatedAt: new Date("2026-11-06T00:02:00Z"),
        action: "MANUAL_REVIEW_REQUIRED",
      },
    ]);
    expect(csv.split("\r\n")[0]).toBe(reconciliationColumns.join(","));
    expect(csv).toContain('"2026-11-06T00:00:00.000Z"');
    expect(csv).not.toContain("customerEmail");
    expect(csv).not.toContain("checkoutUrl");
  });

  it("prevents CSV formula injection even after whitespace", () => {
    for (const value of [
      '=HYPERLINK("https://evil.test")',
      "+SUM(1,2)",
      "-1+3",
      "@SUM(1+1)",
      "   =1+1",
      "\t=IMPORTXML(1,2)",
      "\r\n+2+2",
    ]) {
      const exported = safeCsvCell(value);
      expect(exported).toMatch(/^"/);
      expect(exported.replace(/^"/, "").trimStart()).toMatch(/^'/);
      expect(exported).not.toMatch(/[\r\n\t]/);
    }
  });

  it("escapes quotes, strips row-breaking controls and never emits raw line breaks in cells", () => {
    const value = safeCsvCell('EC-ref"\r\nNew\tRow');
    expect(value).toBe('"EC-ref""  New Row"');
    expect(safeCsvCell(false)).toBe('"false"');
  });

  it("encodes strict opaque pagination cursors", () => {
    const value = encodeReconciliationCursor("payment-id_42");
    expect(decodeReconciliationCursor(value)).toBe("payment-id_42");
    for (const invalid of ["", "!", "!!!!", "abc=", "AQ", " "]) {
      expect(decodeReconciliationCursor(invalid)).toBeNull();
    }
    expect(decodeReconciliationCursor("a".repeat(513))).toBeNull();
  });
});
