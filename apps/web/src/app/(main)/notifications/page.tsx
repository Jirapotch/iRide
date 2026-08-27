import { getRequestLocale } from "@/lib/request-locale";
import { NotificationsScreen } from "../_components/demo-screens";
export default async function NotificationsPage() { return <NotificationsScreen locale={await getRequestLocale()} />; }
