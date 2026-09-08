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

  const longitudes = coordinates.map(({ longitude }) => longitude);
  const latitudes = coordinates.map(({ latitude }) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeSpan = maxLongitude - minLongitude;
  const latitudeSpan = maxLatitude - minLatitude;

  return coordinates.map(({ latitude, longitude }, index) => ({
    x:
      longitudeSpan === 0
        ? 12 + (76 * index) / (coordinates.length - 1)
        : 12 + ((longitude - minLongitude) / longitudeSpan) * 76,
    y:
      latitudeSpan === 0
        ? 88 - (76 * index) / (coordinates.length - 1)
        : 88 - ((latitude - minLatitude) / latitudeSpan) * 76,
  }));
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
