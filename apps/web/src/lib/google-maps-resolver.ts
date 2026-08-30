import {
  parseGoogleMapsCoordinates,
  type Coordinates,
} from "./google-maps-domain";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

export async function resolveGoogleMapsCoordinates(
  input: string,
  fetcher: Fetcher = fetch,
): Promise<Coordinates | null> {
  const direct = parseGoogleMapsCoordinates(input);
  if (direct) return direct;
  let current: URL;
  try {
    current = new URL(input.trim());
  } catch {
    return null;
  }
  for (let redirects = 0; redirects < 5; redirects++) {
    if (
      current.protocol !== "https:" ||
      !ALLOWED_HOSTS.has(current.hostname.toLowerCase())
    )
      return null;
    let response: Response;
    try {
      response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "iRide location importer" },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return null;
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      const parsed = parseGoogleMapsCoordinates(current.toString());
      if (parsed) return parsed;
      continue;
    }
    return parseGoogleMapsCoordinates(response.url || current.toString());
  }
  return null;
}
