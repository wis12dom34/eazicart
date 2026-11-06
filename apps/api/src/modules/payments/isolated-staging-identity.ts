/**
 * Disposable-only identity marker for local/staging fixture mode.
 * This route is registered only by the already guarded KoraPay test harness.
 * It is never registered by production app.ts or server.ts.
 */
export const stagingIdentity = {
  service: "eazicart-native-staging",
  environment: "disposable-fixture",
  contractVersion: 1,
  nativeCheckoutEnabled: false,
  paymentMode: "synthetic-only",
  databaseMode: "temporary-postgresql",
} as const;
