import {
  buildKoraCheckout,
  checkKoraCharge,
  checkKoraCheckoutResponse,
  type KoraCheck,
  type KoraPayment,
} from "./korapay-migration-candidate.js";

// UNREGISTERED: sandbox-only, no production route, no wallet/order writes.
export type KoraFetcher = (url: string, init: RequestInit) => Promise<Response>;
export type KoraCheckoutInput = Parameters<typeof buildKoraCheckout>[0];
export type KoraCheckoutResult =
  { ok: true; checkoutUrl: string } | { ok: false; reason: string };
const root = "https://api.korapay.com/merchant/api/v1/charges";
const fail = (reason: string): KoraCheckoutResult => ({ ok: false, reason });
async function getJson(response: Response): Promise<unknown> {
  if (
    !response.ok ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  )
    return null;
  const size = Number(response.headers.get("content-length") || 0);
  if (!Number.isFinite(size) || size > 32768) return null;
  const raw = await response.text();
  if (raw.length > 32768) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
export async function initializeKoraCheckoutCandidate(
  input: KoraCheckoutInput,
  secret: string,
  fetcher: KoraFetcher = fetch,
): Promise<KoraCheckoutResult> {
  if (!secret) return fail("Missing server credentials");
  let body: ReturnType<typeof buildKoraCheckout>;
  try {
    body = buildKoraCheckout(input);
  } catch {
    return fail("Invalid checkout input");
  }
  try {
    const response = await fetcher(`${root}/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const json = await getJson(response);
    const url = checkKoraCheckoutResponse(input.reference, json);
    return url
      ? { ok: true, checkoutUrl: url }
      : fail("Checkout response could not be verified");
  } catch {
    return fail("Checkout provider unavailable");
  }
}
export async function verifyKoraChargeCandidate(
  payment: KoraPayment,
  secret: string,
  fetcher: KoraFetcher = fetch,
): Promise<KoraCheck> {
  const unknown = (reason: string): KoraCheck => ({
    status: "UNVERIFIED",
    reason,
  });
  if (!secret || !/^EC-[A-Za-z0-9-]{8,80}$/.test(payment.reference))
    return unknown("Missing trusted charge reference or credentials");
  try {
    const response = await fetcher(
      `${root}/${encodeURIComponent(payment.reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    const json = await getJson(response);
    return json === null
      ? unknown("Provider response unavailable")
      : checkKoraCharge(payment, json);
  } catch {
    return unknown("Charge verification unavailable");
  }
}
