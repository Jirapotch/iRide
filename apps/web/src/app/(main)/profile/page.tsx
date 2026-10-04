import { redirect } from "next/navigation";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";
import { CachedOwnProfile } from "./cached-own-profile";
import { Suspense } from "react";
import { OwnActivities } from "./own-activities";
import { ProfileTabSkeleton } from "@/features/profile/components/profile-tab-controller";
import {
  ownProfileHref,
  type ProfileQuery,
} from "@/features/profile/profile-routing";

export default async function OwnProfilePage({
  searchParams,
}: {
  readonly searchParams: Promise<ProfileQuery>;
}) {
  const [session, locale, query] = await Promise.all([
    getVerifiedWebSession(),
    getRequestLocale(),
    searchParams,
  ]);
  if (!session)
    redirect(`/login?next=${encodeURIComponent(ownProfileHref(query))}`);
  return (
    <CachedOwnProfile
      locale={locale}
      query={query}
      userId={session.userId}
      activities={
        query.tab === "activities" ? (
          <Suspense
            fallback={<ProfileTabSkeleton locale={locale} tab="activities" />}
          >
            <OwnActivities accessToken={session.accessToken} locale={locale} />
          </Suspense>
        ) : null
      }
    />
  );
}
