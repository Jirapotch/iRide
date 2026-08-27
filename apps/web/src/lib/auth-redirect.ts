const MAX_REDIRECT_LENGTH = 2_048;
const DEFAULT_AUTH_PATH = "/account";

export function safeNextPath(
  value: string | null | undefined,
): string {
  return safeLocalPath(value, DEFAULT_AUTH_PATH);
}

export function safeReturnPath(
  value: string | null | undefined,
): string {
  return safeLocalPath(value, "/");
}

function safeLocalPath(
  value: string | null | undefined,
  fallback: string,
): string {
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
    const decodedParsed = new URL(decoded, "https://iride.invalid");
    if (
      parsed.origin !== "https://iride.invalid" ||
      decodedParsed.origin !== "https://iride.invalid" ||
      parsed.username ||
      parsed.password ||
      decodedParsed.username ||
      decodedParsed.password ||
      /^\/(?:th|en)(?:\/|$)/.test(decodedParsed.pathname)
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
