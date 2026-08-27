import { getRequestLocale } from "@/lib/request-locale";
import { ActivityHub } from "./_components/activity-hub";

export default async function HomePage() {
  return <ActivityHub locale={await getRequestLocale()} />;
}
