import {
  parseGoogleMapsCoordinates,
  isGoogleMapsDirections,
  type Coordinates,
} from "./google-maps-domain";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type GoogleMapsResolveErrorCode =
  | "invalid-url"
  | "unsupported-host"
  | "directions-url"
  | "redirect-failed"
  | "timeout"
  | "no-coordinates";

export type GoogleMapsResolveResult =
  | { readonly ok: true; readonly location: Coordinates }
  | { readonly ok: false; readonly code: GoogleMapsResolveErrorCode };

const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 256 * 1024;
const TOTAL_TIMEOUT_MS = 8000;

export async function resolveGoogleMapsCoordinates(
  input: string,
  fetcher: Fetcher = fetch,
): Promise<GoogleMapsResolveResult> {
  let current: URL;
  try {
    current = new URL(input.trim());
  } catch {
    return failure("invalid-url");
  }

  const invalid = validateGoogleMapsUrl(current);
  if (invalid) return failure(invalid);
  const direct = parseGoogleMapsCoordinates(current.toString());
  if (direct) return success(direct);

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const visited = new Set<string>();

  let redirects = 0;
  while (true) {
    if (visited.has(current.href)) return failure("redirect-failed");
    visited.add(current.href);

    const remaining = deadline - Date.now();
    if (remaining <= 0) return failure("timeout");

    let response: Response;
    try {
      response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "iRide location importer" },
        signal: AbortSignal.timeout(remaining),
      });
    } catch (error) {
      return failure(isTimeoutError(error) ? "timeout" : "redirect-failed");
    }

    if (response.status >= 300 && response.status < 400) {
      if (redirects >= MAX_REDIRECTS) return failure("redirect-failed");
      const location = response.headers.get("location");
      if (!location) return failure("redirect-failed");
      try {
        current = new URL(location, current);
      } catch {
        return failure("redirect-failed");
      }
      const redirectedInvalid = validateGoogleMapsUrl(current);
      if (redirectedInvalid) return failure(redirectedInvalid);
      const parsed = parseGoogleMapsCoordinates(current.toString());
      if (parsed) return success(parsed);
      redirects += 1;
      continue;
    }

    if (!response.ok) return failure("redirect-failed");

    if (response.url) {
      let responseUrl: URL;
      try {
        responseUrl = new URL(response.url);
      } catch {
        return failure("redirect-failed");
      }
      const responseUrlInvalid = validateGoogleMapsUrl(responseUrl);
      if (responseUrlInvalid) return failure(responseUrlInvalid);
      const parsed = parseGoogleMapsCoordinates(responseUrl.toString());
      if (parsed) return success(parsed);
    }

    if (response.headers.get("content-type")?.includes("text/html")) {
      let html: string;
      try {
        html = await readLimitedText(response, MAX_HTML_BYTES);
      } catch (error) {
        return failure(isTimeoutError(error) ? "timeout" : "redirect-failed");
      }
      for (const candidate of googleMapsUrlsInHtml(html)) {
        let metadataUrl: URL;
        try {
          metadataUrl = new URL(candidate, current);
        } catch {
          continue;
        }
        const metadataInvalid = validateGoogleMapsUrl(metadataUrl);
        if (metadataInvalid) return failure(metadataInvalid);
        const parsed = parseGoogleMapsCoordinates(metadataUrl.toString());
        if (parsed) return success(parsed);
      }
    }

    return failure("no-coordinates");
  }
}

function validateGoogleMapsUrl(
  url: URL,
): "unsupported-host" | "directions-url" | null {
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return "unsupported-host";
  }
  return isGoogleMapsDirections(url.toString()) ? "directions-url" : null;
}

async function readLimitedText(response: Response, limit: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  while (bytes < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = limit - bytes;
    const chunk =
      value.byteLength > remaining ? value.subarray(0, remaining) : value;
    bytes += chunk.byteLength;
    result += decoder.decode(chunk, { stream: bytes < limit });
    if (bytes >= limit) {
      await reader.cancel();
      break;
    }
  }
  return result + decoder.decode();
}

function googleMapsUrlsInHtml(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<(?:link|meta)\b[^>]*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of match[0].matchAll(
      /([:\w-]+)\s*=\s*(["'])(.*?)\2/g,
    )) {
      attributes.set(attribute[1]!.toLowerCase(), attribute[3]!);
    }
    const rel = attributes.get("rel")?.toLowerCase();
    const property = (
      attributes.get("property") ?? attributes.get("name")
    )?.toLowerCase();
    const candidate = rel?.split(/\s+/).includes("canonical")
      ? attributes.get("href")
      : property === "og:url"
        ? attributes.get("content")
        : undefined;
    if (candidate) urls.push(candidate.replaceAll("&amp;", "&"));
  }
  return urls;
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function success(location: Coordinates): GoogleMapsResolveResult {
  return { ok: true, location };
}

function failure(code: GoogleMapsResolveErrorCode): GoogleMapsResolveResult {
  return { ok: false, code };
}
