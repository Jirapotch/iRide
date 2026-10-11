export class GarageError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GarageError("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw new GarageError("UNKNOWN_FIELD");
  return input;
}
function text(value: unknown, required = false, limit = 160): string | null {
  if (value == null || value === "") {
    if (required) throw new GarageError("REQUIRED_FIELD");
    return null;
  }
  if (typeof value !== "string" || value.trim().length > limit)
    throw new GarageError("INVALID_TEXT");
  const result = value.trim();
  if (required && !result) throw new GarageError("REQUIRED_FIELD");
  return result || null;
}
function number(value: unknown, max: number, integer = false): number | null {
  if (value == null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new GarageError("INVALID_NUMBER");
  return value;
}
export function uuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new GarageError("INVALID_ID");
  return value;
}
export function vehicleInput(value: unknown) {
  const input = object(value, [
    "name",
    "brand",
    "model",
    "year",
    "plate",
    "mileageKm",
  ]);
  const year = number(input.year, 2100, true);
  if (year !== null && year < 1900) throw new GarageError("INVALID_YEAR");
  return {
    name: text(input.name, true)!,
    brand: text(input.brand),
    model: text(input.model),
    year,
    plate: text(input.plate, false, 40),
    mileageKm: number(input.mileageKm, 10_000_000, true),
  };
}
export function serviceInput(value: unknown) {
  const input = object(value, [
    "title",
    "occurredOn",
    "mileageKm",
    "workshop",
    "cost",
    "notes",
  ]);
  const date = text(input.occurredOn, true)!;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new GarageError("INVALID_DATE");
  const cost = number(input.cost, 100_000_000);
  if (cost !== null && Math.abs(cost * 100 - Math.round(cost * 100)) > 0.000001)
    throw new GarageError("INVALID_COST");
  return {
    title: text(input.title, true)!,
    occurredOn: date,
    mileageKm: number(input.mileageKm, 10_000_000, true),
    workshop: text(input.workshop),
    cost,
    notes: text(input.notes, false, 4000),
  };
}
export function coverInput(value: unknown) {
  const input = object(value, ["coverPhotoId"]);
  return input.coverPhotoId === null ? null : uuid(String(input.coverPhotoId));
}
export function pageInput(query: URLSearchParams) {
  const page = Number(query.get("page") ?? 1);
  const pageSize = Number(query.get("pageSize") ?? 8);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50
  )
    throw new GarageError("INVALID_PAGE");
  return { page, pageSize };
}
export const MAX_IMAGE_BYTES = 4_000_000;
export function validateImage(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new GarageError("IMAGE_TOO_LARGE", 413);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    (mime === "image/jpeg" && jpeg) ||
    (mime === "image/png" && png) ||
    (mime === "image/webp" && webp)
  )
    return mime;
  throw new GarageError("INVALID_IMAGE_TYPE");
}
