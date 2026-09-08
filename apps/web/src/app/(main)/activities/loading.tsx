import styles from "@/features/activities/components/activities.module.css";
import { ActivitiesSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function ActivitiesLoading() {
  const locale = await getRequestLocale();
  return (
    <main className={styles.page}>
      <div aria-hidden className="skeleton-heading" />
      <ActivitiesSkeleton locale={locale} />
    </main>
  );
}
