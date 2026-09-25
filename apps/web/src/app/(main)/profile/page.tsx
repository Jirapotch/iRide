import { redirect } from "next/navigation";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";
import { CachedOwnProfile } from "./cached-own-profile";

export default async function OwnProfilePage() {
  const [session, locale] = await Promise.all([
    getVerifiedWebSession(),
    getRequestLocale(),
  ]);
  if (!session) redirect("/login?next=%2Fprofile");
  return <CachedOwnProfile locale={locale} userId={session.userId} />;
}
