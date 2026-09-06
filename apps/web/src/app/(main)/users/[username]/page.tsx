import { Suspense } from "react";
import { notFound } from "next/navigation";

import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile, getPublicProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { ProfileSkeleton } from "../../_components/page-skeletons";
import { ProfileTabContent } from "./profile-tab-content";
import { UserProfileScreen } from "./user-profile-screen";

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ username: string }>;
  readonly searchParams: Promise<{
    tab?: string;
    vehicle?: string;
    modal?: string;
  }>;
}) {
  const [{ username }, query, locale, session] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
    getVerifiedWebSession(),
  ]);
  const [profile, ownProfile] = await Promise.all([
    getPublicProfile(username, session?.accessToken),
    session
      ? getOwnProfile(session.accessToken).catch(() => null)
      : Promise.resolve(null),
  ]);
  if (!profile) notFound();
  const ownerProfile =
    ownProfile?.username === profile.username ? ownProfile : null;
  const tab =
    query.tab === "garage" || query.tab === "activities"
      ? query.tab
      : "overview";
  return (
    <div className="profile-route">
      <Breadcrumbs
        items={resolveBreadcrumbs(`/users/${encodeURIComponent(username)}`, {
          entityLabel: profile.displayName,
          locale,
          tab,
        })}
        locale={locale}
      />
      <UserProfileScreen
        initialTab={tab}
        locale={locale}
        ownerProfile={ownerProfile}
        profile={profile}
        tabContent={
          tab === "overview" ? null : (
            <Suspense fallback={<ProfileSkeleton />}>
              <ProfileTabContent
                accessToken={session?.accessToken}
                canManage={ownProfile?.canManage ?? false}
                locale={locale}
                modal={query.modal}
                ownerProfile={ownerProfile}
                selectedVehicleId={query.vehicle}
                tab={tab}
                username={profile.username}
              />
            </Suspense>
          )
        }
      />
    </div>
  );
}
