import { z } from "zod";

// UNREGISTERED migration candidate. No production routes, secrets, or writes.
// Kora amounts are in MAJOR units (NGN), unlike Paystack's kobo amounts.
const amount = z
  .union([
    z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    z.number().nonnegative().finite().safe(),
  ])
  .transform(String);
const verifyShape = z.object({
  status: z.literal(true),
  data: z.object({
    reference: z.string(),
    status: z.string(),
    amount,
    amount_paid: amount,
    currency: z.string(),
  }),
});
const initShape = z.object({
  status: z.literal(true),
  data: z.object({ reference: z.string(), checkout_url: z.string().url() }),
});
const toMinor = (value: string): bigint | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [major = "0", fraction = ""] = value.split(".");
  return BigInt(major) * 100n + BigInt(fraction.padEnd(2, "0"));
};
export type KoraPayment = {
  reference: string;
  amountMinorUnits: string;
  currency: string;
};
export type KoraCheck = {
  status: "VERIFIED" | "NOT_PAID" | "UNVERIFIED";
  reason: string;
};
export function checkKoraCharge(payment: KoraPayment, raw: unknown): KoraCheck {
  const parsed = verifyShape.safeParse(raw);
  const unknown = (reason: string): KoraCheck => ({
    status: "UNVERIFIED",
    reason,
  });
  if (!parsed.success) return unknown("Invalid provider verification response");
  const charge = parsed.data.data;
  if (
    charge.reference !== payment.reference ||
    charge.currency !== payment.currency
  )
    return unknown("Charge identity mismatch");
  const expected = toMinor(payment.amountMinorUnits); // input is minor units; parse separately below
  const amountMinor = /^\d+$/.test(payment.amountMinorUnits)
    ? BigInt(payment.amountMinorUnits)
    : null;
  if (expected === null || amountMinor === null || amountMinor <= 0n)
    return unknown("Invalid expected payment amount");
  if (charge.status !== "success")
    return {
      status: "NOT_PAID",
      reason: "Provider does not report a successful charge",
    };
  if (
    toMinor(charge.amount) !== amountMinor ||
    toMinor(charge.amount_paid) !== amountMinor
  )
    return unknown("Provider amount or amount paid does not match");
  return {
    status: "VERIFIED",
    reason: "Reference, currency, amount and paid amount verified",
  };
}
export function buildKoraCheckout(input: {
  reference: string;
  amountMinorUnits: string;
  currency: string;
  email: string;
  redirectUrl: string;
  notificationUrl?: string;
}) {
  if (
    !/^EC-[A-Za-z0-9-]{8,80}$/.test(input.reference) ||
    !/^\d+$/.test(input.amountMinorUnits) ||
    BigInt(input.amountMinorUnits) <= 0n ||
    BigInt(input.amountMinorUnits) % 100n !== 0n ||
    BigInt(input.amountMinorUnits) / 100n > BigInt(Number.MAX_SAFE_INTEGER) ||
    input.currency !== "NGN" ||
    !z.string().email().safeParse(input.email).success ||
    !z.string().url().safeParse(input.redirectUrl).success ||
    (input.notificationUrl !== undefined &&
      (!z.string().url().safeParse(input.notificationUrl).success ||
        new URL(input.notificationUrl).protocol !== "https:"))
  )
    throw new Error("Invalid Kora checkout input");
  return {
    reference: input.reference,
    amount: Number(BigInt(input.amountMinorUnits) / 100n),
    currency: "NGN",
    customer: { email: input.email },
    redirect_url: input.redirectUrl,
    ...(input.notificationUrl
      ? { notification_url: input.notificationUrl }
      : {}),
  };
}
export function checkKoraCheckoutResponse(
  reference: string,
  raw: unknown,
): string | null {
  const parsed = initShape.safeParse(raw);
  if (!parsed.success || parsed.data.data.reference !== reference) return null;
  const url = new URL(parsed.data.data.checkout_url);
  return url.protocol === "https:" &&
    (url.hostname === "checkout.korapay.com" ||
      url.hostname.endsWith(".checkout.korapay.com"))
    ? url.toString()
    : null;
}
