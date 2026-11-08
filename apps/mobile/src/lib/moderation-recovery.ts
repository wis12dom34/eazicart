import { ApiError } from "./api";

/** No optimistic writes: moderators must verify the server's final state. */
export function moderationFailure(error: unknown): {
  title: string;
  message: string;
  refresh: boolean;
} {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.code === "REPORT_STATUS_CONFLICT")
      return {
        title: "Report already updated",
        message:
          "Another administrator changed this report. Refresh the queue before trying again.",
        refresh: true,
      };
    if (error.status === 401 || error.status === 403)
      return {
        title: "Access denied",
        message:
          "Your session or administrator permission may have changed. Sign in again if needed.",
        refresh: false,
      };
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")
      return {
        title: "Connection interrupted",
        message:
          "The server may have saved your action. Reconnect and refresh the report before trying again.",
        refresh: true,
      };
  }
  return {
    title: "Review not saved",
    message:
      error instanceof Error
        ? error.message
        : "Please refresh the report before retrying.",
    refresh: false,
  };
}

export function moderationQueueFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403)
      return "Administrator access is required. Sign in with an authorized account.";
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")
      return "Cannot load reports. Check your connection, then try again.";
    if (error.code === "INVALID_CURSOR")
      return "The report list changed. Refresh to start again.";
  }
  return "Could not load reports. Try again.";
}
