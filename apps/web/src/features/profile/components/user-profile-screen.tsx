"use client";

import { Button } from "antd";
import type { OwnProfileDto, PublicProfileDto } from "@iride/types";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { attachProfileMediaAction } from "@/app/media-actions";
import { editProfile } from "@/app/profile/actions";
import { ProfileForm } from "@/app/profile/profile-form";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { mediaVariantUrl } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";

import { MediaUploader } from "./media-uploader";

interface Props {
  readonly initialTab?: string;
  readonly locale: Locale;
  readonly ownerProfile: OwnProfileDto | null;
  readonly profile: PublicProfileDto;
  readonly tabContent: ReactNode;
}

export function UserProfileScreen({
  initialTab,
  locale,
  ownerProfile,
  profile,
  tabContent,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const tab =
    initialTab === "garage" || initialTab === "activities"
      ? initialTab
      : "overview";
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const text =
    locale === "th"
      ? {
          profile: "โปรไฟล์ผู้ขับขี่",
          location: "พื้นที่",
          edit: "แก้ไข",
          editHeading: "แก้ไขโปรไฟล์",
          cancel: "ยกเลิก",
          emptyBio: "ยังไม่ได้เขียนคำแนะนำตัว",
          overview: "ภาพรวม",
          garage: "Garage",
          activities: "กิจกรรม",
        }
      : {
          profile: "Rider profile",
          location: "Location",
          edit: "Edit",
          editHeading: "Edit profile",
          cancel: "Cancel",
          emptyBio: "No bio yet.",
          overview: "Overview",
          garage: "Garage",
          activities: "Activities",
        };

  async function attach(kind: "avatar" | "cover", id: string) {
    await attachProfileMediaAction(kind, id);
    router.refresh();
  }

  return (
    <article className="user-profile-shell">
      <div className="profile-cover-media">
        {profile.coverMediaId ? (
          <Image
            alt="Profile cover"
            fill
            priority
            sizes="960px"
            src={mediaVariantUrl(profile.coverMediaId)}
            unoptimized
          />
        ) : (
          <div
            aria-label="Profile cover placeholder"
            className="profile-cover-placeholder"
            role="img"
          />
        )}
        <div aria-hidden="true" />
      </div>
      <div className="user-profile-body">
        <div className="user-profile-avatar">
          {profile.avatarMediaId ? (
            <Image
              alt={profile.displayName}
              fill
              sizes="112px"
              src={mediaVariantUrl(profile.avatarMediaId)}
              unoptimized
            />
          ) : (
            initials
          )}
        </div>
        {editing && ownerProfile ? (
          <section className="profile-inline-editor">
            <div className="section-heading">
              <div>
                <p className="premium-kicker">{text.profile}</p>
                <h1>{text.editHeading}</h1>
              </div>
              <button onClick={() => setEditing(false)} type="button">
                {text.cancel}
              </button>
            </div>
            {ownerProfile.canWrite ? (
              <div className="profile-media-editors">
                <section>
                  <h2>{locale === "th" ? "รูปโปรไฟล์" : "Profile photo"}</h2>
                  <MediaUploader
                    cropRatio={1}
                    locale={locale}
                    onReady={(id) => attach("avatar", id)}
                    purpose="avatar"
                  />
                </section>
                <section>
                  <h2>{locale === "th" ? "ภาพ Cover" : "Cover image"}</h2>
                  <MediaUploader
                    cropRatio={3}
                    locale={locale}
                    onReady={(id) => attach("cover", id)}
                    purpose="cover"
                  />
                </section>
              </div>
            ) : null}
            <ProfileForm
              action={editProfile}
              initialProfile={ownerProfile}
              locale={locale}
            />
          </section>
        ) : (
          <>
            <div className="profile-title-row">
              <div className="space-y-2">
                <p className="premium-kicker">{text.profile}</p>
                <h1 data-route-heading tabIndex={-1}>
                  {profile.displayName}
                </h1>
                <p className="font-mono text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
              {ownerProfile ? (
                <Button onClick={() => setEditing(true)} type="primary">
                  {text.edit}
                </Button>
              ) : null}
            </div>
            <p className="leading-7 text-muted-foreground">
              {profile.bio ?? text.emptyBio}
            </p>
            {profile.locationName ? (
              <dl className="rounded-2xl border border-border bg-background/25 p-4 text-sm">
                <dt className="text-muted-foreground">{text.location}</dt>
                <dd className="mt-1 font-medium">{profile.locationName}</dd>
              </dl>
            ) : null}
            <nav
              className="profile-tabs"
              aria-label={
                locale === "th" ? "ส่วนของโปรไฟล์" : "Profile sections"
              }
            >
              {(["overview", "garage", "activities"] as const).map((value) => (
                <PendingLink
                  aria-current={tab === value ? "page" : undefined}
                  href={`/users/${profile.username}${value === "overview" ? "" : `?tab=${value}`}`}
                  key={value}
                >
                  {text[value]}
                </PendingLink>
              ))}
            </nav>
            {tab === "overview" ? (
              <section
                className="profile-overview-grid"
                data-navigation-focus-target="profile-panel"
                tabIndex={-1}
              >
                <article className="premium-card p-5">
                  <p className="premium-kicker">
                    {locale === "th" ? "พื้นที่" : "Area"}
                  </p>
                  <p>
                    {profile.locationName ??
                      (locale === "th" ? "ยังไม่ระบุพื้นที่" : "No area added")}
                  </p>
                </article>
                <article className="premium-card p-5">
                  <p className="premium-kicker">Garage</p>
                  <PendingLink href={`/users/${profile.username}?tab=garage`}>
                    {locale === "th" ? "เปิด Garage" : "View garage"}
                  </PendingLink>
                </article>
              </section>
            ) : null}
            {tab !== "overview" ? (
              <div data-navigation-focus-target="profile-panel" tabIndex={-1}>
                {tabContent}
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
