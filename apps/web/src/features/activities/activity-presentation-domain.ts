import type { EventDto, EventKind } from "@iride/types";
import type { Locale } from "@/lib/locale";

export type ActivityKindFilter = "all" | EventKind;
export type ActivityPeriod = "upcoming" | "past";
export type ActivityStatus = "today" | "upcoming" | "past" | "unscheduled";

export interface ActivityFilters {
  readonly kind: ActivityKindFilter;
  readonly period: ActivityPeriod;
}

export interface ActivityRoutePoint {
  readonly role: "location" | "start" | "stop" | "destination";
  readonly name: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface CoordinateActivityRoutePoint {
  readonly index: number;
  readonly point: ActivityRoutePoint & {
    readonly latitude: number;
    readonly longitude: number;
  };
}

export function activityStatus(
  event: EventDto,
  now = new Date(),
): ActivityStatus {
  const start = instant(event.startsAt);
  if (!start) return "unscheduled";
  const end = instant(event.endsAt);
  if (end && end.getTime() < now.getTime()) return "past";

  const startDay = dateKey(start, event.timezone);
  const today = dateKey(now, event.timezone);
  if (startDay === today || (start < now && end && end >= now)) return "today";
  return startDay < today ? "past" : "upcoming";
}

export function filterAndSortActivities(
  events: readonly EventDto[],
  filters: ActivityFilters,
  now = new Date(),
): EventDto[] {
  return events
    .filter((event) => filters.kind === "all" || event.kind === filters.kind)
    .filter((event) => {
      const status = activityStatus(event, now);
      return filters.period === "past" ? status === "past" : status !== "past";
    })
    .sort((left, right) => {
      const leftTime = activityTime(left, filters.period);
      const rightTime = activityTime(right, filters.period);
      if (leftTime === null) return rightTime === null ? 0 : 1;
      if (rightTime === null) return -1;
      return filters.period === "past"
        ? rightTime - leftTime
        : leftTime - rightTime;
    });
}

export function routePointsForEvent(event: EventDto): ActivityRoutePoint[] {
  if (event.kind !== "trip") {
    return event.locationLabel ||
      hasCoordinates(event.latitude, event.longitude)
      ? [
          {
            role: "location",
            name: event.locationLabel ?? event.title,
            latitude: event.latitude,
            longitude: event.longitude,
          },
        ]
      : [];
  }

  const points: ActivityRoutePoint[] = [];
  if (event.locationLabel || hasCoordinates(event.latitude, event.longitude)) {
    points.push({
      role: "start",
      name: event.locationLabel ?? event.title,
      latitude: event.latitude,
      longitude: event.longitude,
    });
  }
  points.push(
    ...(event.stops ?? []).map((stop) => ({
      role: "stop" as const,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
  );
  if (
    event.destinationLabel ||
    hasCoordinates(event.destinationLatitude, event.destinationLongitude)
  ) {
    points.push({
      role: "destination",
      name: event.destinationLabel ?? event.title,
      latitude: event.destinationLatitude,
      longitude: event.destinationLongitude,
    });
  }
  return points;
}

export function coordinateRoutePointsForEvent(
  event: EventDto,
): CoordinateActivityRoutePoint[] {
  return routePointsForEvent(event)
    .map((point, index) => ({ point, index }))
    .filter(
      (entry): entry is CoordinateActivityRoutePoint =>
        hasCoordinates(entry.point.latitude, entry.point.longitude),
    );
}

export function projectRoutePoints(
  points: readonly Pick<
    ActivityRoutePoint,
    "latitude" | "longitude" | "name" | "role"
  >[],
): { readonly x: number; readonly y: number }[] {
  const coordinates = points.filter(
    (point): point is typeof point & { latitude: number; longitude: number } =>
      hasCoordinates(point.latitude, point.longitude),
  );
  if (!coordinates.length) return [];
  if (coordinates.length === 1) return [{ x: 50, y: 50 }];

  const projected = coordinates.map(({ latitude, longitude }) => ({
    x: degreesToRadians(longitude),
    y: webMercatorY(latitude),
  }));
  const xs = projected.map(({ x }) => x);
  const ys = projected.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  if (span === 0) return projected.map(() => ({ x: 50, y: 50 }));

  const scale = 76 / span;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return projected.map(({ x, y }) => ({
    x: roundedSvgCoordinate(50 + (x - centerX) * scale),
    y: roundedSvgCoordinate(50 - (y - centerY) * scale),
  }));
}

const MAX_MERCATOR_LATITUDE = 85.05112878;

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function webMercatorY(latitude: number) {
  const clamped = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const radians = degreesToRadians(clamped);
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function roundedSvgCoordinate(value: number) {
  return Number(value.toFixed(6));
}

export function formatActivityDate(event: EventDto, locale: Locale) {
  if (!event.startsAt) {
    return locale === "th" ? "ยังไม่กำหนดวันเวลา" : "Date not set";
  }
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}

function activityTime(event: EventDto, period: ActivityPeriod) {
  const value =
    period === "past" ? (event.endsAt ?? event.startsAt) : event.startsAt;
  const parsed = instant(value);
  return parsed?.getTime() ?? null;
}

function dateKey(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(
      parts.map(({ type, value }) => [type, value]),
    );
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function instant(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasCoordinates(
  latitude: number | null,
  longitude: number | null,
): latitude is number {
  return latitude !== null && longitude !== null;
}
