import type { Cart, CartItem } from "./types";

export function cartFingerprint(cart: Cart) {
  return JSON.stringify({
    items: cart.items
      .map((item) => ({
        id: item.product.id,
        quantity: item.quantity,
        price: item.unitPrice,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    subtotal: cart.subtotal,
    total: cart.total,
  });
}

export function hasCartChanged(displayed: Cart, latest: Cart) {
  return cartFingerprint(displayed) !== cartFingerprint(latest);
}

export function formatNaira(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`
    : "₦—";
}

export function canCheckoutReview(cart: Cart) {
  return (
    cart.items.length > 0 &&
    cart.items.every(
      (item: CartItem) =>
        item.quantity > 0 &&
        item.product.active !== false &&
        item.quantity <= item.product.stock,
    )
  );
}
