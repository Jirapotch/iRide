import {
  ArrowSquareOut,
  FlagCheckered,
  MapPin,
  Play,
} from "@phosphor-icons/react/dist/ssr";
import type { EventDto } from "@iride/types";

import { googleMapsLocationUrl } from "@/lib/google-maps-domain";
import type { Locale } from "@/lib/locale";
import {
  type ActivityRoutePoint,
  routePointsForEvent,
} from "../activity-presentation-domain";
import styles from "./activities.module.css";

export function RouteStops({
  event,
  locale,
  onSelectPoint,
  selectedIndex = null,
}: {
  readonly event: EventDto;
  readonly locale: Locale;
  readonly onSelectPoint?: (point: ActivityRoutePoint, index: number) => void;
  readonly selectedIndex?: number | null;
}) {
  const points = routePointsForEvent(event);
  if (!points.length) {
    return (
      <p className={styles.emptyRoute}>
        {locale === "th"
          ? "ยังไม่มีข้อมูลสถานที่"
          : "No location is available yet."}
      </p>
    );
  }

  return (
    <ol className={styles.routeStops}>
      {points.map((point, index) => {
        const stopNumber =
          point.role === "stop"
            ? points.slice(0, index + 1).filter(({ role }) => role === "stop")
                .length
            : null;
        const href = googleMapsLocationUrl(point);
        const label =
          point.role === "start"
            ? locale === "th"
              ? "จุดเริ่มต้น"
              : "Start"
            : point.role === "destination"
              ? locale === "th"
                ? "จุดหมาย"
                : "Destination"
              : point.role === "location"
                ? locale === "th"
                  ? "สถานที่"
                  : "Location"
                : locale === "th"
                  ? `จุดแวะ ${stopNumber}`
                  : `Stop ${stopNumber}`;
        const Icon =
          point.role === "start"
            ? Play
            : point.role === "destination"
              ? FlagCheckered
              : MapPin;
        const markerContent =
          point.role === "stop" ? (
            stopNumber
          ) : (
            <Icon aria-hidden size={16} weight="fill" />
          );
        const canSelect =
          onSelectPoint &&
          point.latitude != null &&
          point.longitude != null;
        return (
          <li
            className={
              point.role === "destination" ? "trip-destination" : undefined
            }
            data-route-stop
            key={`${point.role}-${index}-${point.name}`}
          >
            {canSelect ? (
              <button
                aria-label={
                  locale === "th"
                    ? `แสดง ${point.name} บนแผนที่`
                    : `Show ${point.name} on map`
                }
                aria-pressed={selectedIndex === index}
                className={`${styles.routeMarker} ${styles.routeMarkerButton}`}
                onClick={() => onSelectPoint(point, index)}
                type="button"
              >
                {markerContent}
              </button>
            ) : (
              <span className={styles.routeMarker}>{markerContent}</span>
            )}
            <div className={styles.routeStopBody}>
              <small>{label}</small>
              <strong>{point.name}</strong>
              {point.latitude != null && point.longitude != null ? (
                <span>
                  {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                </span>
              ) : null}
            </div>
            {href ? (
              <a
                className={styles.mapLink}
                href={href}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ArrowSquareOut aria-hidden size={16} />
                {locale === "th" ? "ดูใน Google Maps" : "Open in Google Maps"}
              </a>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
