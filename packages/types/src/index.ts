/** Identifier aliases keep contracts readable without coupling them to storage. */
export type UserId = string;
export type ProductId = string;
export type SellerId = string;

export interface Money {
  amountMinor: number;
  currency: "NGN";
}
