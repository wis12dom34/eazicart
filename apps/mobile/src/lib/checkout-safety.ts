/**
 * EaziCart's currently registered production /payments/initialize API still
 * calls Paystack. KoraPay exists only in isolated, unregistered backend preview
 * routes. These functions validate an eventual KoraPay contract but never
 * initiate a payment. DO NOT switch on production checkout in this module.
 */
export const NATIVE_PRODUCTION_CHECKOUT_ENABLED = false as const;
export const NATIVE_CHECKOUT_BLOCK_REASON =
  "Native online payment remains disabled until an approved, idempotent KoraPay production API is available.";

export type KoraCheckoutSession = {
  orderId: string;
  reference: string;
  status: "PENDING";
  provider: "KORAPAY";
  currency: "NGN";
  authorizationUrl: string;
};
export type KoraVerifyResult = {
  orderId: string;
  reference: string;
  status: "PENDING" | "CONFIRMED" | "REVIEW_REQUIRED";
};
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}
function unwrapData(value: unknown): UnknownRecord | null {
  const outer = asRecord(value);
  return asRecord(outer?.data) ?? outer;
}

/** Never open a user-controlled or redirect-provided payment URL. */
export function trustedKoraCheckoutUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (host !== "checkout.korapay.com" &&
        !host.endsWith(".checkout.korapay.com")) ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function readKoraSession(
  value: unknown,
  expectedOrderId: string,
): KoraCheckoutSession | null {
  const data = unwrapData(value);
  if (
    !data ||
    data.orderId !== expectedOrderId ||
    data.provider !== "KORAPAY" ||
    data.status !== "PENDING" ||
    data.currency !== "NGN" ||
    typeof data.reference !== "string" ||
    !/^EC-[A-Za-z0-9-]{8,80}$/.test(data.reference)
  )
    return null;
  const authorizationUrl = trustedKoraCheckoutUrl(data.authorizationUrl);
  if (!authorizationUrl) return null;
  return {
    orderId: expectedOrderId,
    reference: data.reference,
    status: "PENDING",
    provider: "KORAPAY",
    currency: "NGN",
    authorizationUrl,
  };
}

/**
 * Only trust a verified server response obtained by an authenticated request
 * to a server-enforced owner-scoped endpoint. Never infer payment success from
 * deep links, webview return URLs, push notifications, or client query strings.
 */
export function readKoraVerification(
  raw: unknown,
  expected: Pick<KoraCheckoutSession, "orderId" | "reference">,
): KoraVerifyResult | null {
  const data = unwrapData(raw);
  if (
    !data ||
    data.orderId !== expected.orderId ||
    data.reference !== expected.reference ||
    (data.status !== "PENDING" &&
      data.status !== "CONFIRMED" &&
      data.status !== "REVIEW_REQUIRED")
  )
    return null;
  return {
    orderId: expected.orderId,
    reference: expected.reference,
    status: data.status,
  };
}
