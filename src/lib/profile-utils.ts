export function isGoogleAvatarUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "lh3.googleusercontent.com";
  } catch {
    return false;
  }
}

export function resolveAvatarUrl(storageUrl: string | null, providerUrl: string | null | undefined) {
  if (storageUrl) return storageUrl;
  return isGoogleAvatarUrl(providerUrl) ? providerUrl : null;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "IR";
}
