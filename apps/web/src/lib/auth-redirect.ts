import { defaultPathForLocale, type Locale } from "./locale";

const MAX_REDIRECT_LENGTH = 2_048;

export function safeNextPath(
  value: string | null | undefined,
  locale: Locale,
): string {
  const fallback = defaultPathForLocale(locale);
  if (
    !value ||
    value.length > MAX_REDIRECT_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    hasUnsafeCharacters(value)
  ) {
    return fallback;
  }

  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return fallback;
    }

    if (
      decoded.startsWith("//") ||
      hasUnsafeCharacters(decoded) ||
      decoded.includes("#")
    ) {
      return fallback;
    }
  }

  try {
    const parsed = new URL(value, "https://iride.invalid");
    if (
      parsed.origin !== "https://iride.invalid" ||
      parsed.username ||
      parsed.password ||
      !parsed.pathname.startsWith(`/${locale}`) ||
      (parsed.pathname !== `/${locale}` &&
        !parsed.pathname.startsWith(`/${locale}/`))
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

function hasUnsafeCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === "\\" || code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}
