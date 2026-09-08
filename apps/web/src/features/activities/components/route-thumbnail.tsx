import type { EventDto } from "@iride/types";

import {
  projectRoutePoints,
  routePointsForEvent,
} from "../activity-presentation-domain";
import styles from "./activities.module.css";

export function RouteThumbnail({ event }: { readonly event: EventDto }) {
  const points = projectRoutePoints(routePointsForEvent(event));
  const visible =
    points.length > 0
      ? points
      : [
          { x: 18, y: 78 },
          { x: 48, y: 45 },
          { x: 82, y: 22 },
        ];
  const path = visible.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <div aria-hidden="true" className={styles.thumbnail}>
      <svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 100">
        <defs>
          <pattern
            id={`route-grid-${event.id}`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 12 0 L 0 0 0 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.45"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#route-grid-${event.id})`} />
        {visible.length > 1 ? <polyline points={path} /> : null}
        {visible.map(({ x, y }, index) => (
          <circle
            className={
              index === visible.length - 1 ? styles.finishDot : undefined
            }
            cx={x}
            cy={y}
            key={`${x}-${y}-${index}`}
            r={index === visible.length - 1 ? 4.5 : 3.2}
          />
        ))}
      </svg>
      <span>{event.kind === "trip" ? "ROUTE" : "MEET POINT"}</span>
    </div>
  );
}
