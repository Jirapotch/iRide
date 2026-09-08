import {
  ArrowRight,
  CalendarBlank,
  MapTrifold,
} from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";

import styles from "@/features/activities/components/activities.module.css";
import { formatActivityDate } from "@/features/activities/activity-presentation-domain";
import { ActivitiesRetryPanel } from "@/features/activities/components/retry-panel";
import { RouteStops } from "@/features/activities/components/route-stops";
import { RouteThumbnail } from "@/features/activities/components/route-thumbnail";
import { getActivityKindLabel } from "@/features/activities/activity-kind-label";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { resolveBreadcrumbs, mapStateHref } from "@/lib/app-navigation-domain";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvent } from "@/lib/content-api";
import { captureData } from "@/lib/data-result";
import { getRequestLocale } from "@/lib/request-locale";

export default async function ActivityDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const [locale, route, session] = await Promise.all([
    getRequestLocale(),
    params,
    getVerifiedWebSession().catch(() => null),
  ]);
  const result = await captureData(() =>
    getEvent(route.id, session?.accessToken),
  );
  if (result.status === "error" && result.error.category === "not-found")
    notFound();

  if (result.status === "error") {
    return (
      <main className={styles.page}>
        <Breadcrumbs
          items={resolveBreadcrumbs(
            `/activities/${encodeURIComponent(route.id)}`,
            { locale },
          )}
          locale={locale}
        />
        <ActivitiesRetryPanel locale={locale} />
      </main>
    );
  }

  const event = result.data;
  return (
    <main className={styles.page}>
      <Breadcrumbs
        items={resolveBreadcrumbs(
          `/activities/${encodeURIComponent(event.id)}`,
          {
            locale,
            entityLabel: event.title,
          },
        )}
        locale={locale}
      />
      <article className={styles.detailCard}>
        <div className={styles.detailCover}>
          <RouteThumbnail event={event} />
        </div>
        <div className={styles.detailBody}>
          <header className={styles.heading}>
            <span>{getActivityKindLabel(event.kind, locale)}</span>
            <h1 data-route-heading tabIndex={-1}>
              {event.title}
            </h1>
            {event.description ? <p>{event.description}</p> : null}
          </header>
          <div className={styles.detailMeta}>
            <span>
              <CalendarBlank aria-hidden size={17} />{" "}
              {formatActivityDate(event, locale)}
            </span>
            <PendingLink
              href={`/users/${encodeURIComponent(event.organizer.username)}`}
            >
              {event.organizer.displayName}
            </PendingLink>
          </div>
          <section className={styles.detailSection}>
            <h2>
              {event.kind === "trip"
                ? locale === "th"
                  ? "จุดหมายและที่แวะ"
                  : "Destination and stops"
                : locale === "th"
                  ? "สถานที่"
                  : "Location"}
            </h2>
            <RouteStops event={event} locale={locale} />
          </section>
          <PendingLink
            className={styles.mapCta}
            href={mapStateHref({
              kinds: ["meeting", "event", "trip"],
              marker: event.id,
              from: "activities",
            })}
          >
            <MapTrifold aria-hidden size={18} />
            {locale === "th" ? "ดูบนแผนที่ iRide" : "View on iRide map"}
            <ArrowRight aria-hidden size={16} />
          </PendingLink>
        </div>
      </article>
    </main>
  );
}
