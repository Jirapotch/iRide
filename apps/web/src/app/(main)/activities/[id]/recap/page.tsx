import { notFound } from "next/navigation";
import Image from "next/image";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvent, getTripRecap, mediaVariantUrl } from "@/lib/content-api";
import { getRequestLocale } from "@/lib/request-locale";
import { ShareRecapButton } from "./share-recap-button";

export default async function TripRecapPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const [{ id }, locale, session] = await Promise.all([
    params,
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
  ]);
  const [event, recap] = await Promise.all([
    getEvent(id, session?.accessToken).catch(() => null),
    getTripRecap(id, session?.accessToken).catch(() => null),
  ]);
  if (!event || event.kind !== "trip" || !recap) notFound();
  return (
    <main className="trip-recap-page">
      <Breadcrumbs
        items={[
          ...resolveBreadcrumbs(`/activities/${encodeURIComponent(id)}`, {
            locale,
            entityLabel: event.title,
          }).map((item) =>
            item.key === "activity"
              ? { ...item, href: `/activities/${encodeURIComponent(id)}` }
              : item,
          ),
          {
            key: "recap",
            label: locale === "th" ? "บันทึกหลังทริป" : "Trip recap",
          },
        ]}
        locale={locale}
      />
      <article className="premium-card trip-recap-article">
        <p className="premium-kicker">
          {locale === "th" ? "เรื่องราวหลังทริป" : "After the ride"}
        </p>
        <h1 data-route-heading tabIndex={-1}>
          {event.title}
        </h1>
        <p>{recap.summary}</p>
        <div className="trip-recap-share">
          <ShareRecapButton locale={locale} />
          <PendingLink href={`/activities/${encodeURIComponent(id)}`}>
            {locale === "th" ? "กลับไปหน้าทริป" : "Back to trip"}
          </PendingLink>
        </div>
        <section>
          <h2>{locale === "th" ? "เส้นทางที่บันทึก" : "Saved route"}</h2>
          {recap.routePoints.length ? (
            <ol className="trip-recap-route">
              {recap.routePoints.map((point, index) => (
                <li key={index}>
                  <strong>{point.name}</strong>
                  <small>
                    {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              {locale === "th"
                ? "ยังไม่มีหมุดเส้นทาง"
                : "No route points were saved."}
            </p>
          )}
        </section>
        <section>
          <h2>
            {locale === "th" ? "รูปและรีวิวจุดแวะ" : "Photos and stop reviews"}
          </h2>
          <div className="trip-recap-entries">
            {recap.entries.map((entry) => (
              <article key={entry.id}>
                <PendingLink
                  href={`/users/${encodeURIComponent(entry.author.username)}`}
                >
                  {entry.author.displayName}
                </PendingLink>
                {entry.stopName ? <small>{entry.stopName}</small> : null}
                {entry.review ? <p>{entry.review}</p> : null}
                <div className="trip-recap-photos">
                  {entry.mediaIds.map((mediaId) => (
                    <Image
                      alt={
                        entry.stopName ??
                        (locale === "th" ? "ภาพทริป" : "Trip photo")
                      }
                      key={mediaId}
                      src={mediaVariantUrl(mediaId)}
                      width={640}
                      height={480}
                      unoptimized
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
