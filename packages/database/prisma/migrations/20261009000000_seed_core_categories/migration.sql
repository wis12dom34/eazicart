-- Core marketplace taxonomy required before sellers can create products.
-- These are configuration records, not demo catalog inventory.
INSERT INTO "Category" ("id", "name", "slug")
VALUES
  ('category-electronics', 'Electronics', 'electronics'),
  ('category-fashion', 'Fashion', 'fashion'),
  ('category-beauty-personal-care', 'Beauty & Personal Care', 'beauty-personal-care'),
  ('category-home-living', 'Home & Living', 'home-living'),
  ('category-groceries', 'Groceries', 'groceries'),
  ('category-sports-fitness', 'Sports & Fitness', 'sports-fitness')
ON CONFLICT DO NOTHING;
