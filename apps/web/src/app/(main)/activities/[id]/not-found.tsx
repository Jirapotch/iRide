import styles from "@/features/activities/components/activities.module.css";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { getRequestLocale } from "@/lib/request-locale";

export default async function ActivityNotFound() {
  const locale = await getRequestLocale();
  return (
    <main className={styles.page}>
      <div className="empty-state">
        <h1 data-route-heading tabIndex={-1}>
          {locale === "th" ? "ไม่พบกิจกรรม" : "Activity not found"}
        </h1>
        <p>
          {locale === "th"
            ? "กิจกรรมนี้อาจถูกลบหรือไม่พร้อมใช้งานแล้ว"
            : "The activity may have been removed or is no longer available."}
        </p>
        <PendingLink href="/activities">
          {locale === "th" ? "กลับไปหน้ากิจกรรม" : "Back to activities"}
        </PendingLink>
      </div>
    </main>
  );
}
