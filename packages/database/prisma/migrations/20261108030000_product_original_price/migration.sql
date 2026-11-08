-- Additive-only: the current selling price remains Product.price,
-- the authoritative value used by cart and checkout.
ALTER TABLE "Product" ADD COLUMN "originalPrice" DECIMAL(12, 2);
ALTER TABLE "Product" ADD CONSTRAINT "Product_originalPrice_above_price_check"
  CHECK ("originalPrice" IS NULL OR "originalPrice" > "price");
