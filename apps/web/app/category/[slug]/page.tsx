import { notFound } from "next/navigation";
import { cache } from "react";
import {
  getPublicCategories,
  getPublicProducts,
} from "../../../lib/public-catalog";
import { pageMetadata } from "../../../lib/seo";
import { breadcrumbs } from "../../../lib/catalog-schema";
import { StructuredData } from "../../components/structured-data";
import CategoryContent from "./category-content";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const getCategory = cache(
  async (slug: string, search: string, page: number) => {
    const query = new URLSearchParams({
      category: slug,
      limit: "20",
      page: String(page),
    });
    if (search) query.set("search", search);
    const [categories, products] = await Promise.all([
      getPublicCategories(),
      getPublicProducts(query.toString()),
    ]);
    const category =
      categories.status === "ok"
        ? categories.data.find((c) => c.slug === slug)
        : undefined;
    return { categories, products, category };
  },
);
async function input(props: Props) {
  const [{ slug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const page = Math.max(1, Number(query.page) || 1);
  const search =
    typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
  return { slug, query, search, page };
}
export async function generateMetadata(props: Props) {
  const { slug, query, search, page } = await input(props);
  const { category, categories, products } = await getCategory(
    slug,
    search,
    page,
  );
  if (categories.status === "ok" && !category) notFound();
  if (products.status === "ok" && page > 1 && !products.data.data.length)
    notFound();
  const eligible = Boolean(
    category && products.status === "ok" && products.data.data.length,
  );
  const path = `/category/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ""}`;
  return pageMetadata(
    category
      ? `${category.name}${page > 1 ? ` – Page ${page}` : ""}`
      : "Category unavailable",
    category
      ? `Explore ${category.name.toLowerCase()} products and their sellers on EaziCart. View current product details and availability.`
      : "Browse the current EaziCart marketplace categories.",
    path,
    {
      index: eligible && Object.keys(query).every((key) => key === "page"),
      catalog: true,
    },
  );
}
export default async function CategoryPage(props: Props) {
  const { slug, search, page } = await input(props);
  const { category, categories, products } = await getCategory(
    slug,
    search,
    page,
  );
  if (categories.status === "ok" && !category) notFound();
  if (products.status === "ok" && page > 1 && !products.data.data.length)
    notFound();
  const trail = category
    ? breadcrumbs([
        { name: "EaziCart", path: "/landing" },
        { name: category.name, path: `/category/${encodeURIComponent(slug)}` },
      ])
    : undefined;
  return (
    <>
      {trail ? <StructuredData data={trail} /> : null}
      <CategoryContent
        key={`${slug}:${search}:${page}`}
        slug={slug}
        initialCategories={
          categories.status === "ok" ? categories.data : undefined
        }
        initialProducts={products.status === "ok" ? products.data : undefined}
        initialError={
          categories.status === "ok" && products.status === "ok"
            ? ""
            : "Category details are temporarily unavailable. Please try again."
        }
      />
    </>
  );
}
