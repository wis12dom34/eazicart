export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  if (Array.from(value).some((character) => character.charCodeAt(0) <= 32))
    return "/";
  return value;
}
