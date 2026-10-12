import { SiteNotice } from "@/features/site-notice";
import { getRequestLocale } from "@/lib/request-locale";
export const metadata = { title: "Privacy" };
export default async function PrivacyPage() {
  return <SiteNotice kind="privacy" locale={await getRequestLocale()} />;
}
