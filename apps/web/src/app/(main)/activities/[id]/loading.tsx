import styles from "@/features/activities/components/activities.module.css";
import { ActivityDetailSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function ActivityDetailLoading() {
  const locale = await getRequestLocale();
  return (
    <main className={styles.page}>
      <ActivityDetailSkeleton locale={locale} />
    </main>
  );
}
