/**
 * Strictly development-only admin audit client. It NEVER reuses EaziCart's
 * production buyer/seller access token. Only a separately supplied, ephemeral
 * disposable-staging ADMIN token may be used. Endpoints are GET-only.
 */
export const ADMIN_AUDIT_PATH = "/preview/admin/korapay/reconciliation";

export type AuditState = "INITIATING" | "UNKNOWN";
export type AuditReport = {
  generatedAt: string;
  uncertainTotal: number;
  counts: { INITIATING: number; UNKNOWN: number };
  action: "MANUAL_REVIEW_REQUIRED";
  automaticReinitializationAllowed: false;
  automaticSettlementAllowed: false;
};
export type AuditClaim = {
  paymentId: string;
  orderId: string;
  reference: string;
  state: AuditState;
  paymentStatus: string;
  currency: string;
  referenceMatches: boolean;
  createdAt: string;
  updatedAt: string;
  action: "MANUAL_REVIEW_REQUIRED";
};
export type AuditProbe = {
  paymentId: string;
  orderId: string;
  reference: string;
  localStatus: string;
  initiationState: AuditState;
  providerCheck: string;
  providerReason?: string;
  action: "MANUAL_REVIEW_REQUIRED";
  mayInitializeAgain: false;
  localPaymentUpdated: false;
};

export class AuditPreviewError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuditPreviewError";
  }
}

/** Refuse ALL production websites, provider hosts and unexpected URL schemes. */
export function verifiedAuditPreviewBase(
  raw: string | undefined,
  isDev: boolean,
): string | null {
  if (!isDev || !raw) return null;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      !url.pathname.endsWith("/api") ||
      url.search !== "" ||
      url.hash !== "" ||
      Boolean(url.username) ||
      Boolean(url.password) ||
      hostname.includes("eazicart.com") ||
      hostname.includes("korapay.com") ||
      (!local &&
        !hostname.endsWith(".test") &&
        !hostname.startsWith("staging-"))
    )
      return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function currentAuditPreviewBase() {
  const enabled =
    process.env.EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW === "1";
  const development = typeof __DEV__ !== "undefined" && __DEV__;
  const configuredBase = process.env
    .EXPO_PUBLIC_EAZICART_ADMIN_AUDIT_PREVIEW_BASE_URL as string | undefined;
  return verifiedAuditPreviewBase(
    configuredBase,
    Boolean(enabled && development),
  );
}

/** Credentials remain memory-only; reject whitespace and oversized inputs. */
/** A dismissed device share sheet must never advance the export cursor. */
export function afterAuditCsvShare(
  shared: boolean,
  hasMore: boolean,
  nextCursor: string | null,
): { advance: boolean; exhausted: boolean; nextCursor: string | null } {
  return {
    advance: shared,
    exhausted: shared && !hasMore,
    nextCursor: shared && hasMore ? nextCursor : null,
  };
}

export function isValidAuditStagingToken(value: string): boolean {
  const token = value.trim();
  return token.length >= 12 && token.length <= 4096 && !/\s/.test(token);
}

export function makeAuditPreviewClient(
  base: string,
  stagingToken: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15_000,
) {
  // A release build must never create a finance-audit client, even if this
  // function is invoked directly through an unexpected navigation path.
  if (typeof __DEV__ !== "undefined" && __DEV__ === false)
    throw new AuditPreviewError(
      0,
      "Admin audit is disabled in production builds.",
    );
  // Even programmatic callers must pass the restrictive staging-origin check.
  const safeBase = verifiedAuditPreviewBase(base, true);
  if (!safeBase)
    throw new AuditPreviewError(0, "An isolated staging API is required.");
  const approvedOrigin = new URL(safeBase).origin;
  const token = stagingToken.trim();
  if (!isValidAuditStagingToken(token))
    throw new AuditPreviewError(
      401,
      "A separate staging administrator token is required.",
    );

  async function get(path: string, signal?: AbortSignal): Promise<Response> {
    if (!path.startsWith(ADMIN_AUDIT_PATH) || /[\r\n]/.test(path))
      throw new AuditPreviewError(
        0,
        "Only read-only reconciliation endpoints are available.",
      );
    if (signal?.aborted)
      throw new AuditPreviewError(499, "Staging request cancelled.");
    const controller = new AbortController();
    let rejectStopped!: (error: AuditPreviewError) => void;
    const stopped = new Promise<never>(
      (_, reject: (reason: AuditPreviewError) => void) => {
        rejectStopped = reject;
      },
    );
    const cancel = () => {
      controller.abort();
      rejectStopped(new AuditPreviewError(499, "Staging request cancelled."));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    const boundedTimeoutMs = Math.max(25, Math.min(30_000, timeoutMs));
    const timeout = setTimeout(() => {
      controller.abort();
      rejectStopped(
        new AuditPreviewError(
          408,
          "Staging request timed out. Retry when connected.",
        ),
      );
    }, boundedTimeoutMs);

    let response: Response;
    try {
      response = await Promise.race([
        fetcher(safeBase + path, {
          method: "GET",
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json, text/csv",
          },
          signal: controller.signal,
          cache: "no-store",
          redirect: "error",
        }),
        stopped,
      ]);
    } catch (reason) {
      if (reason instanceof AuditPreviewError) throw reason;
      if (signal?.aborted)
        throw new AuditPreviewError(499, "Staging request cancelled.");
      throw new AuditPreviewError(
        503,
        "Staging network unavailable. No payment action was performed.",
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
    if (response.url) {
      const returned = new URL(response.url);
      if (returned.origin !== approvedOrigin) {
        throw new AuditPreviewError(0, "Unexpected staging redirect.");
      }
    }
    if (response.status === 401)
      throw new AuditPreviewError(401, "Staging login required or expired.");
    if (response.status === 403)
      throw new AuditPreviewError(
        403,
        "An authorized staging ADMIN account is required.",
      );
    if (!response.ok)
      throw new AuditPreviewError(
        response.status,
        "Audit request failed. Check the staging server.",
      );
    return response;
  }

  const path = ADMIN_AUDIT_PATH;
  return {
    report: async (signal?: AbortSignal): Promise<AuditReport> =>
      (
        (await (await get(path + "/report", signal)).json()) as {
          data: AuditReport;
        }
      ).data,
    list: async (
      state?: AuditState,
      signal?: AbortSignal,
    ): Promise<AuditClaim[]> =>
      (
        (await (
          await get(path + (state ? "?state=" + state : ""), signal)
        ).json()) as {
          data: AuditClaim[];
        }
      ).data,
    probe: async (
      paymentId: string,
      signal?: AbortSignal,
    ): Promise<AuditProbe> => {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(paymentId))
        throw new AuditPreviewError(0, "Invalid payment ID");
      return (
        (await (
          await get(
            path + "/" + encodeURIComponent(paymentId) + "/probe",
            signal,
          )
        ).json()) as {
          data: AuditProbe;
        }
      ).data;
    },
    csvPage: async (
      state?: AuditState,
      cursor?: string,
      signal?: AbortSignal,
    ) => {
      const qs = new URLSearchParams({ limit: "100" });
      if (state) qs.set("state", state);
      if (cursor) {
        if (!/^[A-Za-z0-9_-]{2,512}$/.test(cursor))
          throw new AuditPreviewError(0, "Invalid page cursor");
        qs.set("cursor", cursor);
      }
      const response = await get(path + "/export.csv?" + qs.toString(), signal);
      const csv = await response.text();
      if (csv.length > 512_000)
        throw new AuditPreviewError(0, "CSV page exceeds safety limit.");
      const more = response.headers.get("X-Export-Has-More") === "true";
      const nextCursor = more
        ? response.headers.get("X-Export-Next-Cursor")
        : null;
      if (more && (!nextCursor || !/^[A-Za-z0-9_-]{2,512}$/.test(nextCursor)))
        throw new AuditPreviewError(0, "Invalid staging pagination response.");
      return { csv, hasMore: more, nextCursor };
    },
  };
}
