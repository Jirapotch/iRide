import { SiteNotice } from "@/features/site-notice";
import { getRequestLocale } from "@/lib/request-locale";
export const metadata = { title: "Terms of use" };
export default async function TermsPage() {
  return <SiteNotice kind="terms" locale={await getRequestLocale()} />;
}
