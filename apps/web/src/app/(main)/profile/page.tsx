import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";
import { ProfileOverview } from "../_components/demo-screens";

export default async function ProfilePage() {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
  ]);
  if (!session) redirect("/login?next=%2Fprofile");
  return <ProfileOverview locale={locale} />;
}
