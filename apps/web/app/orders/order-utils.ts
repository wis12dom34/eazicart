export function orderStatusLabel(status: string) {
  if (status === "PENDING") return "Processing";
  if (status === "FULFILLED") return "Delivered";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "CONFIRMED") return "Confirmed";
  return status;
}

export function orderStatusCopy(status: string) {
  if (status === "CONFIRMED") return "Your order has been confirmed.";
  if (status === "FULFILLED") return "This order is marked as delivered.";
  if (status === "CANCELLED") return "This order has been cancelled.";
  return "Your order was created and is waiting for confirmation.";
}

export function multiplyMoney(value: string, quantity: number) {
  const [whole = "0", fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const total = cents * BigInt(quantity);
  const totalWhole = total / 100n;
  const totalFraction = total % 100n;

  return totalFraction
    ? `${totalWhole}.${totalFraction.toString().padStart(2, "0")}`
    : totalWhole.toString();
}
