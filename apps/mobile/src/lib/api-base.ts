/**
 * The native app must never silently fall back to EaziCart production.
 * Android QA builds also apply a separate approved-host and staging attestation.
 */
export function resolveMobileApiBaseUrl(raw: string | undefined): string {
  if (!raw || raw.trim() !== raw || raw.length === 0) {
    throw new Error(
      "EaziCart mobile API is not configured. Set an explicit HTTPS API URL.",
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("EaziCart mobile API URL is invalid.");
  }
  const localHttp =
    url.protocol === "http:" && url.hostname.toLowerCase() === "localhost";
  if (
    (url.protocol !== "https:" && !localHttp) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api"
  ) {
    throw new Error(
      "EaziCart mobile API requires HTTPS at /api (localhost HTTP allowed for local development).",
    );
  }
  return url.origin + "/api";
}
