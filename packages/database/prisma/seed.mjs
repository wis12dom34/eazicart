import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import process from "node:process";
import console from "node:console";

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seed is disabled in production");
}
if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error("Set ALLOW_DEMO_SEED=true for a development database only");
}
const db = new PrismaClient();
const categories = [
  ["fashion", "Fashion"],
  ["home", "Home & living"],
  ["electronics", "Electronics"],
];
const sellers = [
  ["lagos-studio", "Lagos Studio", "Demo fashion and everyday essentials."],
  ["home-edit", "Home Edit", "Demo pieces for your home and workspace."],
];
const products = [
  ["woven-tote", "Woven everyday tote", "fashion", "lagos-studio", "18500"],
  ["linen-shirt", "Relaxed linen shirt", "fashion", "lagos-studio", "24000"],
  ["ceramic-mug", "Ceramic coffee mug", "home", "home-edit", "6500"],
  ["desk-lamp", "Minimal desk lamp", "electronics", "home-edit", "32000"],
];
try {
  await db.$transaction(async (tx) => {
    for (const [slug, name] of categories) {
      await tx.category.upsert({
        where: { slug },
        create: { id: `demo-category-${slug}`, slug, name },
        update: {},
      });
    }
    for (const [slug, displayName, bio] of sellers) {
      // Seller records have no shared demo login or reusable password.
      const passwordHash = await argon2.hash(randomBytes(48).toString("hex"));
      await tx.user.upsert({
        where: { id: `demo-user-${slug}` },
        create: {
          id: `demo-user-${slug}`,
          email: `${slug}@demo.eazicart.invalid`,
          name: displayName,
          role: "SELLER",
          passwordHash,
          sellerProfile: {
            create: { id: `demo-seller-${slug}`, displayName, bio },
          },
        },
        update: {},
      });
    }
    for (const [slug, name, category, seller, price] of products) {
      const categoryRow = await tx.category.findUniqueOrThrow({
        where: { slug: category },
      });
      await tx.product.upsert({
        where: { id: `demo-product-${slug}` },
        create: {
          id: `demo-product-${slug}`,
          name,
          description: "Development catalog item. Demo orders are unpaid.",
          price,
          stock: 50,
          categoryId: categoryRow.id,
          sellerId: `demo-seller-${seller}`,
          images: {
            create: {
              id: `demo-image-${slug}`,
              url: `/demo/${slug}.svg`,
              altText: `${name} demo illustration`,
            },
          },
        },
        update: {},
      });
    }
  });
  console.log("Demo catalog ready: 3 categories, 2 sellers, 4 products.");
} finally {
  await db.$disconnect();
}
