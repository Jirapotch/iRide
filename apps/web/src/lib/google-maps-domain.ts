export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

const GOOGLE_MAP_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
]);

export function parseGoogleMapsCoordinates(input: string): Coordinates | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !GOOGLE_MAP_HOSTS.has(url.hostname.toLowerCase())
  )
    return null;

  const candidates = [
    url.searchParams.get("query"),
    url.searchParams.get("q"),
    url.searchParams.get("center"),
  ];
  const data = `${url.pathname}${url.search}${url.hash}`.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  );
  if (data) candidates.push(`${data[1]},${data[2]}`);
  const at = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|$)/);
  if (at) candidates.push(`${at[1]},${at[2]}`);

  for (const candidate of candidates) {
    const coordinates = parseCoordinatePair(candidate);
    if (coordinates) return coordinates;
  }
  return null;
}

export function googleMapsSearchUrl(coordinates: Coordinates): string {
  const query = encodeURIComponent(
    `${coordinates.latitude},${coordinates.longitude}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function parseCoordinatePair(value: string | null): Coordinates | null {
  const match = value
    ?.trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  return { latitude, longitude };
}
