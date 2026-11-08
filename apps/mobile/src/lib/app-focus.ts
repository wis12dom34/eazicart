/** React Query should refresh stale reads only while the native app is visible. */
export function isNativeAppFocused(state: string | null | undefined): boolean {
  return state === "active";
}
