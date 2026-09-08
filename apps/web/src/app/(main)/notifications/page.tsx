import { getRequestLocale } from "@/lib/request-locale";
import { NotificationsScreen } from "@/features/notifications/components/notifications-screen";
export default async function NotificationsPage() {
  return <NotificationsScreen locale={await getRequestLocale()} />;
}
