import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";

import { ActivityList } from "@/features/activities/components/activity-list";
import { ActivitiesRetryPanel } from "@/features/activities/components/retry-panel";
import styles from "@/features/activities/components/activities.module.css";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getEvents } from "@/lib/content-api";
import { captureData } from "@/lib/data-result";
import { getRequestLocale } from "@/lib/request-locale";

export default async function ActivitiesPage() {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
  ]);
  const result = await captureData(() => getEvents(session?.accessToken));

  return (
    <main className={styles.page}>
      <Breadcrumbs
        items={resolveBreadcrumbs("/activities", { locale })}
        locale={locale}
      />
      <header className={styles.heading}>
        <span aria-hidden>
          <CalendarBlank size={28} weight="duotone" />
        </span>
        <h1 data-route-heading tabIndex={-1}>
          {locale === "th" ? "กิจกรรม" : "Activities"}
        </h1>
        <p>
          {locale === "th"
            ? "เลือกกิจกรรม นัดพบ หรือทริปก่อนเปิดดูเส้นทาง"
            : "Choose an event, meet, or trip before opening its route."}
        </p>
      </header>
      {result.status === "success" ? (
        <ActivityList
          events={result.data}
          locale={locale}
          nowIso={new Date().toISOString()}
        />
      ) : (
        <ActivitiesRetryPanel locale={locale} />
      )}
    </main>
  );
}
