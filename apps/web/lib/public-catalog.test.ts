import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicProduct, getPublicProducts } from "./public-catalog";

const product = {
  id: "p1",
  name: "Real catalog item",
  price: "15000",
  stock: 3,
  active: true,
  images: [{ url: "/figma/logo.svg", altText: "Item", position: 0 }],
  category: { id: "c1", name: "Clothing", slug: "clothing" },
  seller: {
    id: "s1",
    userId: "user-12345",
    displayName: "Store",
    user: { email: "private@example.invalid" },
  },
  internalNotes: "private",
};
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("EAZICART_PUBLIC_API_URL", "https://catalog.eazicart.invalid");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(
    Response.json({
      data: [product],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public catalog caching boundaries", () => {
  it("allows a short public feed cache without forwarding private fields or credentials", async () => {
    const result = await getPublicProducts("limit=100", 15);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://catalog.eazicart.invalid/products?limit=100",
      expect.objectContaining({
        next: { revalidate: 15 },
        headers: { Accept: "application/json" },
      }),
    );
    const options = fetchMock.mock.calls[0]?.[1];
    expect(options?.cache).toBeUndefined();
    expect(options?.headers).toEqual({ Accept: "application/json" });
    expect(result.status).toBe("ok");
    expect(JSON.stringify(result)).not.toContain("private@example.invalid");
    expect(JSON.stringify(result)).not.toContain("internalNotes");
  });
  it("keeps other catalog reads uncached by default", async () => {
    await getPublicProducts("limit=20");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
    expect(fetchMock.mock.calls[0]?.[1]?.next).toBeUndefined();
  });
  it("keeps individual product stock and prices uncached", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: product }));
    const result = await getPublicProduct("p1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
    expect(result).toMatchObject({
      status: "ok",
      data: { stock: 3, price: "15000" },
    });
  });
  it("does not turn an upstream outage into an empty successful catalog", async () => {
    fetchMock.mockResolvedValue(new Response("Unavailable", { status: 503 }));
    expect(await getPublicProducts("limit=100", 15)).toEqual({
      status: "unavailable",
    });
  });
});
