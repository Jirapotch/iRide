import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import {
  ownProfileRedirect,
  type ProfileQuery,
} from "@/features/profile/profile-routing";

import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile, getPublicProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { ProfileTabSkeleton } from "@/features/profile/components/profile-tab-controller";
import { ProfileTabContent } from "./profile-tab-content";
import { UserProfileScreen } from "@/features/profile/components/user-profile-screen";

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ username: string }>;
  readonly searchParams: Promise<ProfileQuery>;
}) {
  const [{ username }, query, locale, session] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
    getVerifiedWebSession(),
  ]);
  const ownProfile = session
    ? getOwnProfile(session.accessToken).catch(() => null)
    : Promise.resolve(null);
  const owner = await ownProfile;
  const ownRedirect = ownProfileRedirect(
    username,
    owner?.username ?? null,
    query,
  );
  if (ownRedirect) redirect(ownRedirect);
  const profile = await getPublicProfile(username, session?.accessToken);
  if (!profile) notFound();
  const ownerProfile = owner?.username === profile.username ? owner : null;
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
            <Suspense
              fallback={<ProfileTabSkeleton locale={locale} tab={tab} />}
            >
              <ProfileTabContent
                accessToken={session?.accessToken}
                canManage={owner?.canManage ?? false}
                locale={locale}
                modal={
                  typeof query.modal === "string" ? query.modal : undefined
                }
                ownerProfile={ownerProfile}
                selectedVehicleId={
                  typeof query.vehicle === "string" ? query.vehicle : undefined
                }
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
