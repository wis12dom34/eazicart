import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
import { cartApi } from "./cart";
import { productsApi } from "./products";
import { authApi } from "./auth";

const requestUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

const requestBody = (init?: RequestInit) => {
  if (typeof init?.body !== "string") {
    throw new Error("Expected request body to be a JSON string");
  }
  return init.body;
};

afterEach(() => vi.unstubAllGlobals());

describe("API client", () => {
  it("surfaces structured non-2xx errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "NOPE", message: "Not available" },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(apiRequest("/failure")).rejects.toMatchObject({
      status: 409,
      code: "NOPE",
      message: "Not available",
    });
  });

  it("supports query parameters and 204 responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      apiRequest("/products", { query: { search: "bag", page: 2 } }),
    ).resolves.toBeUndefined();
    expect(requestUrl(fetchMock.mock.calls[0]![0])).toContain(
      "search=bag&page=2",
    );
  });

  it("fetches product details by encoded id", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "a/b" } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await productsApi.get("a/b");
    expect(requestUrl(fetchMock.mock.calls[0]![0])).toContain(
      "/products/a%2Fb",
    );
  });

  it("cart mutations submit identifiers and quantities, never prices", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: {} }), { status: 201 }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await cartApi.add("product-1", 2);
    await cartApi.update("item-1", 3);
    await cartApi.remove("item-1");
    expect(JSON.parse(requestBody(fetchMock.mock.calls[0]![1]))).toEqual({
      productId: "product-1",
      quantity: 2,
    });
    expect(JSON.parse(requestBody(fetchMock.mock.calls[1]![1]))).toEqual({
      quantity: 3,
    });
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("DELETE");
  });

  it("submits login credentials and omits authorization when signed out", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ user: {}, tokens: {} }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await authApi.login("shopper@example.com", "password123");
    expect(JSON.parse(requestBody(fetchMock.mock.calls[0]![1]))).toEqual({
      email: "shopper@example.com",
      password: "password123",
    });
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("Authorization"),
    ).toBe(false);
  });

  it("aborts stalled requests and returns a useful timeout error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    await expect(apiRequest("/slow", { timeoutMs: 5 })).rejects.toMatchObject({
      status: 408,
      code: "REQUEST_TIMEOUT",
      message:
        "The server took too long to respond. Check your connection and try again.",
    });
  });
});
