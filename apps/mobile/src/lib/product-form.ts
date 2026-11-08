import type { SellerProductInput } from "./types";

export type SellerProductDraft = {
  name: string;
  description: string;
  price: string;
  stock: string;
  categoryId: string;
};

export type ProductFormResult =
  { ok: true; data: SellerProductInput } | { ok: false; message: string };

export function validateSellerProductDraft(
  draft: SellerProductDraft,
): ProductFormResult {
  const name = draft.name.trim();
  const description = draft.description.trim();
  const price = draft.price.trim();
  const stockText = draft.stock.trim();
  if (name.length < 2 || name.length > 160)
    return {
      ok: false,
      message: "Product name must contain 2–160 characters.",
    };
  if (description.length > 5000)
    return {
      ok: false,
      message: "Description is too long (maximum 5,000 characters).",
    };
  if (!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(price))
    return {
      ok: false,
      message: "Enter a valid price in naira, with up to two decimal places.",
    };
  if (
    !/^(?:0|[1-9][0-9]*)$/.test(stockText) ||
    !Number.isSafeInteger(Number(stockText))
  )
    return { ok: false, message: "Stock must be a non-negative whole number." };
  const stock = Number(stockText);
  if (stock > 1_000_000_000)
    return {
      ok: false,
      message: "Stock is too large. Enter a realistic quantity.",
    };
  if (!draft.categoryId.trim())
    return { ok: false, message: "Select a product category." };
  return {
    ok: true,
    data: {
      name,
      description,
      price,
      stock,
      categoryId: draft.categoryId.trim(),
    },
  };
}
