export function safeNextPath(value: string | null | undefined): string {
  const fallback = "/";
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f]/.test(value)) return fallback;
  const normalized = value.replace(/^\/(th|en)(?=\/|$)/, "") || "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
