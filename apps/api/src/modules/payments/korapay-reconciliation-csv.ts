/** Static, allowlisted audit columns. No customer PII, checkout URLs or credentials. */
export const reconciliationColumns = [
  "paymentId",
  "orderId",
  "reference",
  "initiationState",
  "paymentStatus",
  "currency",
  "referenceMatches",
  "createdAt",
  "updatedAt",
  "action",
] as const;

export type ReconciliationCsvRow = Record<
  (typeof reconciliationColumns)[number],
  string | boolean | Date
>;

/**
 * Quoting alone is not sufficient against spreadsheet formula injection.
 * Remove embedded control characters and force spreadsheet text for cells
 * whose left-trimmed value starts with a formula sigil.
 */
export function safeCsvCell(value: string | boolean | Date) {
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const stripped = [...raw]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("");
  const escaped = /^[=+@-]/.test(stripped.trimStart())
    ? "'" + stripped
    : stripped;
  return '"' + escaped.replace(/"/g, '""') + '"';
}

export function reconcileCsv(rows: readonly ReconciliationCsvRow[]) {
  return [
    reconciliationColumns.join(","),
    ...rows.map((row) =>
      reconciliationColumns.map((key) => safeCsvCell(row[key])).join(","),
    ),
    "",
  ].join("\r\n");
}

export function encodeReconciliationCursor(paymentId: string) {
  return Buffer.from(paymentId, "utf8").toString("base64url");
}
export function decodeReconciliationCursor(encoded: string) {
  if (!/^[A-Za-z0-9_-]{2,512}$/.test(encoded)) return null;
  try {
    const result = Buffer.from(encoded, "base64url").toString("utf8");
    return /^[A-Za-z0-9_-]{1,128}$/.test(result) &&
      encodeReconciliationCursor(result) === encoded
      ? result
      : null;
  } catch {
    return null;
  }
}
