"use client";

import type { EventDto, EventKind } from "@iride/types";
import { CalendarBlank, MapPin } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { PendingLink } from "@/features/navigation/components/pending-link";
import type { Locale } from "@/lib/locale";
import {
  activityStatus,
  filterAndSortActivities,
  formatActivityDate,
  type ActivityKindFilter,
  type ActivityPeriod,
} from "../activity-presentation-domain";
import { getActivityKindLabel } from "../activity-kind-label";
import styles from "./activities.module.css";
import { RouteThumbnail } from "./route-thumbnail";

export function ActivityList({
  events,
  locale,
  nowIso,
}: {
  readonly events: readonly EventDto[];
  readonly locale: Locale;
  readonly nowIso: string;
}) {
  const [kind, setKind] = useState<ActivityKindFilter>("all");
  const [period, setPeriod] = useState<ActivityPeriod>("upcoming");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const visible = useMemo(
    () => filterAndSortActivities(events, { kind, period }, now),
    [events, kind, now, period],
  );
  const kinds: ActivityKindFilter[] = ["all", "meeting", "event", "trip"];

  return (
    <>
      <div className={styles.filters}>
        <div
          aria-label={locale === "th" ? "ประเภทกิจกรรม" : "Activity type"}
          role="group"
        >
          {kinds.map((value) => (
            <button
              aria-pressed={kind === value}
              key={value}
              onClick={() => setKind(value)}
              type="button"
            >
              {value === "all"
                ? locale === "th"
                  ? "ทั้งหมด"
                  : "All"
                : getActivityKindLabel(value as EventKind, locale)}
            </button>
          ))}
        </div>
        <div
          aria-label={locale === "th" ? "ช่วงเวลา" : "Time period"}
          role="group"
        >
          {(["upcoming", "past"] as const).map((value) => (
            <button
              aria-pressed={period === value}
              key={value}
              onClick={() => setPeriod(value)}
              type="button"
            >
              {value === "upcoming"
                ? locale === "th"
                  ? "กำลังจะมาถึง"
                  : "Upcoming"
                : locale === "th"
                  ? "ที่ผ่านมา"
                  : "Past"}
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <div className={styles.grid} aria-live="polite">
          {visible.map((event) => (
            <ActivityCard
              event={event}
              key={event.id}
              locale={locale}
              now={now}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state" role="status">
          <CalendarBlank aria-hidden size={40} />
          <strong>
            {locale === "th" ? "ไม่พบกิจกรรม" : "No activities found"}
          </strong>
          <p>
            {locale === "th"
              ? "ลองเปลี่ยนประเภทหรือช่วงเวลาที่เลือก"
              : "Try another activity type or time period."}
          </p>
        </div>
      )}
    </>
  );
}

function ActivityCard({
  event,
  locale,
  now,
}: {
  readonly event: EventDto;
  readonly locale: Locale;
  readonly now: Date;
}) {
  const status = activityStatus(event, now);
  const place =
    event.kind === "trip" ? event.destinationLabel : event.locationLabel;
  return (
    <PendingLink
      aria-label={event.title}
      className={styles.card}
      href={`/activities/${encodeURIComponent(event.id)}`}
    >
      <RouteThumbnail event={event} />
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span>{getActivityKindLabel(event.kind, locale)}</span>
          <span data-status={status}>{statusLabel(status, locale)}</span>
        </div>
        <h2>{event.title}</h2>
        <p>
          <CalendarBlank aria-hidden size={16} />
          {formatActivityDate(event, locale)}
        </p>
        {place ? (
          <p>
            <MapPin aria-hidden size={16} />
            {place}
          </p>
        ) : null}
      </div>
    </PendingLink>
  );
}

function statusLabel(
  status: ReturnType<typeof activityStatus>,
  locale: Locale,
) {
  const labels = {
    th: {
      today: "วันนี้",
      upcoming: "กำลังจะถึง",
      past: "จบแล้ว",
      unscheduled: "ยังไม่กำหนดวัน",
    },
    en: {
      today: "Today",
      upcoming: "Upcoming",
      past: "Ended",
      unscheduled: "Date not set",
    },
  } as const;
  return labels[locale][status];
}
