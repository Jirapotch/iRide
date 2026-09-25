"use client";

import type { OwnProfileDto, PublicProfileDto } from "@iride/types";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { UserProfileScreen } from "@/features/profile/components/user-profile-screen";
import {
  invalidateOwnProfile,
  OWN_PROFILE_TTL_MS,
  selectFreshOwnProfile,
  storeOwnProfile,
} from "@/features/profile/profile-cache.slice";
import type { Locale } from "@/lib/locale";
import { browserApiGet } from "@/services/browser-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export function CachedOwnProfile({
  locale,
  userId,
}: {
  readonly locale: Locale;
  readonly userId: string;
}) {
  const dispatch = useAppDispatch();
  const cache = useAppSelector((state) => state.ownProfileCache);
  const router = useRouter();
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(false);
  const profile =
    cache.userId === userId && cache.profile?.id === userId
      ? cache.profile
      : null;
  useEffect(() => {
    if (cache.userId !== userId || cache.fetchedAt === null) return;
    const remaining = cache.fetchedAt + OWN_PROFILE_TTL_MS - Date.now();
    if (remaining <= 0) {
      dispatch(invalidateOwnProfile());
      return;
    }
    const timer = window.setTimeout(
      () => dispatch(invalidateOwnProfile()),
      remaining,
    );
    return () => window.clearTimeout(timer);
  }, [cache.fetchedAt, cache.userId, dispatch, userId]);
  useEffect(() => {
    if (cache.userId && cache.userId !== userId)
      dispatch(invalidateOwnProfile());
    if (selectFreshOwnProfile(cache, userId, Date.now())) return;
    if (cache.fetchedAt !== null && cache.userId === userId) {
      dispatch(invalidateOwnProfile());
      return;
    }
    let active = true;
    void browserApiGet<OwnProfileDto>("/profile/me")
      .then((next) => {
        if (!active) return;
        if (next.id !== userId) {
          dispatch(invalidateOwnProfile());
          setError(true);
          return;
        }
        dispatch(
          storeOwnProfile({ userId, profile: next, fetchedAt: Date.now() }),
        );
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [cache, dispatch, retry, userId]);
  useEffect(() => {
    if (profile && !profile.isComplete) router.replace("/onboarding");
  }, [profile, router]);
  if (!profile || !profile.username || !profile.displayName) {
    return (
      <main className="profile-route" aria-busy={!error}>
        <h1>{locale === "th" ? "โปรไฟล์ของฉัน" : "My profile"}</h1>
        {error ? (
          <div role="alert">
            <p>
              {locale === "th"
                ? "โหลดโปรไฟล์ไม่ได้"
                : "Could not load your profile."}
            </p>
            <button
              type="button"
              onClick={() => {
                setError(false);
                setRetry((value) => value + 1);
              }}
            >
              {locale === "th" ? "ลองอีกครั้ง" : "Retry"}
            </button>
          </div>
        ) : (
          <p role="status">
            {locale === "th" ? "กำลังโหลดโปรไฟล์…" : "Loading profile…"}
          </p>
        )}
      </main>
    );
  }
  const publicProfile: PublicProfileDto = {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarMediaId: profile.avatarMediaId,
    coverMediaId: profile.coverMediaId,
    locationName: profile.locationName,
    visibility: profile.visibility,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
  return (
    <div className="profile-route">
      <Breadcrumbs
        items={[
          {
            key: "home",
            label: locale === "th" ? "หน้าหลัก" : "Home",
            href: "/",
          },
          {
            key: "profile",
            label: locale === "th" ? "โปรไฟล์ของฉัน" : "My profile",
          },
        ]}
        locale={locale}
      />
      <UserProfileScreen
        initialTab="overview"
        locale={locale}
        ownerProfile={profile}
        profile={publicProfile}
        tabContent={null}
      />
    </div>
  );
}
