import type { Cart, CartItem } from "./types";

/** Snapshot every field that could change what a buyer is reviewing.
 * Stable sorting avoids a false alarm when the server reorders cart items. */
export function cartFingerprint(cart: Cart) {
  return JSON.stringify({
    cartId: cart.id,
    items: cart.items
      .map((item) => ({
        cartItemId: item.id,
        productId: item.product.id,
        variant: item.variantLabel ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        productPrice: item.product.price,
        stock: item.product.stock,
        active: item.product.active !== false,
      }))
      .sort(
        (a, b) =>
          a.productId.localeCompare(b.productId) ||
          a.cartItemId.localeCompare(b.cartItemId) ||
          (a.variant ?? "").localeCompare(b.variant ?? ""),
      ),
    subtotal: cart.subtotal,
    delivery: cart.delivery ?? null,
    serviceFee: cart.serviceFee ?? null,
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
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isSafeInteger(item.product.stock) &&
        item.product.active !== false &&
        item.quantity <= item.product.stock,
    )
  );
}
