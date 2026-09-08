import {
  ArrowSquareOut,
  FlagCheckered,
  MapPin,
  Play,
} from "@phosphor-icons/react/dist/ssr";
import type { EventDto } from "@iride/types";

import { googleMapsLocationUrl } from "@/lib/google-maps-domain";
import type { Locale } from "@/lib/locale";
import { routePointsForEvent } from "../activity-presentation-domain";
import styles from "./activities.module.css";

export function RouteStops({
  event,
  locale,
}: {
  readonly event: EventDto;
  readonly locale: Locale;
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
        return (
          <li data-route-stop key={`${point.role}-${index}-${point.name}`}>
            <span className={styles.routeMarker}>
              {point.role === "stop" ? (
                stopNumber
              ) : (
                <Icon aria-hidden size={16} weight="fill" />
              )}
            </span>
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
