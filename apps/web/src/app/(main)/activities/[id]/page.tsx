import {
  ArrowRight,
  CalendarBlank,
  MapTrifold,
  UserCircle,
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
import { getEvent, getRideGroups } from "@/lib/content-api";
import { getGarage, getTripEngagement } from "@/lib/content-api";
import { getOwnProfile } from "@/lib/profile-api";
import { TripEngagementPanel } from "@/features/activities/components/trip-engagement-panel";
import { captureData } from "@/lib/data-result";
import { getRequestLocale } from "@/lib/request-locale";
import { OwnerActionMenu } from "@/features/community/components/owner-action-menu";
import { removeContent } from "@/app/(main)/create/actions";
import { EditModal } from "@/features/content/components/edit-modal";
import { BackendForm } from "@/features/content/components/content-editor-form";

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ modal?: string }>;
}) {
  const [locale, route, query, session] = await Promise.all([
    getRequestLocale(),
    params,
    searchParams,
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
  const [engagement, ownProfile] =
    event.kind === "trip"
      ? await Promise.all([
          getTripEngagement(event.id, session?.accessToken).catch(() => null),
          session ? getOwnProfile(session.accessToken).catch(() => null) : null,
        ])
      : [null, null];
  const vehicles =
    ownProfile?.username && session
      ? await getGarage(ownProfile.username, session.accessToken).catch(
          () => [],
        )
      : [];
  const groupOptions =
    event.groupId || (query.modal === "edit" && session)
      ? await getRideGroups(session?.accessToken).catch(() => [])
      : [];
  const relatedGroup = event.groupId
    ? groupOptions.find((group) => group.id === event.groupId)
    : null;
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
            {event.canEdit ? (
              <OwnerActionMenu
                confirmText={
                  locale === "th"
                    ? "ลบกิจกรรมนี้หรือไม่?"
                    : "Delete this activity?"
                }
                deleteAction={removeContent}
                editHref={`/activities/${encodeURIComponent(event.id)}?modal=edit`}
                hidden={{ domain: "events", id: event.id }}
                locale={locale}
              />
            ) : null}
            <h1 data-route-heading tabIndex={-1}>
              {event.title}
            </h1>
            {event.description ? <p>{event.description}</p> : null}
          </header>
          <div className={styles.detailMeta}>
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}>
                <CalendarBlank aria-hidden size={20} />
              </span>
              <div>
                <span className={styles.detailMetaLabel}>
                  {locale === "th" ? "วันและเวลา" : "Date and time"}
                </span>
                <time dateTime={event.startsAt ?? undefined}>
                  {formatActivityDate(event, locale)}
                </time>
              </div>
            </div>
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}>
                <UserCircle aria-hidden size={20} />
              </span>
              <div>
                <span className={styles.detailMetaLabel}>
                  {locale === "th" ? "ผู้จัด" : "Organized by"}
                </span>
                <PendingLink
                  href={`/users/${encodeURIComponent(event.organizer.username)}`}
                >
                  {event.organizer.displayName}
                </PendingLink>
              </div>
            </div>
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
          {relatedGroup ? (
            <PendingLink
              href={`/community/groups/${encodeURIComponent(relatedGroup.slug)}`}
            >
              {locale === "th" ? "กลุ่มผู้จัด: " : "Group: "}
              {relatedGroup.name}
            </PendingLink>
          ) : null}
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
      {event.kind === "trip" ? (
        <TripEngagementPanel
          authenticated={Boolean(session)}
          event={event}
          initial={engagement}
          locale={locale}
          vehicles={vehicles}
          viewerId={session?.userId ?? null}
        />
      ) : null}
      {query.modal === "edit" && event.canEdit ? (
        <EditModal
          closeUrl={`/activities/${encodeURIComponent(event.id)}`}
          title={locale === "th" ? "แก้ไขกิจกรรม" : "Edit activity"}
        >
          <BackendForm
            initial={event}
            groupOptions={groupOptions.filter((group) => group.isMember)}
            locale={locale}
            type={event.kind === "trip" ? "trip" : "activity"}
          />
        </EditModal>
      ) : null}
    </main>
  );
}
