"use client";

import { Button, ConfigProvider, Modal, Typography } from "antd";
import enUS from "antd/locale/en_US";
import thTH from "antd/locale/th_TH";
import { MapPin, NotePencil } from "@phosphor-icons/react";
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
import { ProfileTabController } from "./profile-tab-controller";
import { invalidateOwnProfile, storeOwnProfile } from "../profile-cache.slice";
import { useAppDispatch } from "@/store/hooks";
import styles from "./profile-shell.module.css";

interface Props {
  readonly initialTab?: string;
  readonly locale: Locale;
  readonly ownerProfile: OwnProfileDto | null;
  readonly profile: PublicProfileDto;
  readonly tabContent: ReactNode;
  readonly overviewContent?: ReactNode;
}

export function UserProfileScreen({
  initialTab,
  locale,
  ownerProfile,
  profile,
  tabContent,
  overviewContent,
}: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
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
    const updated = await attachProfileMediaAction(kind, id);
    dispatch(
      storeOwnProfile({
        userId: updated.id,
        profile: updated,
        fetchedAt: Date.now(),
      }),
    );
    router.refresh();
  }

  return (
    <ConfigProvider
      locale={locale === "th" ? thTH : enUS}
      form={{
        validateMessages: {
          required:
            locale === "th" ? "กรุณากรอก${label}" : "${label} is required.",
        },
      }}
    >
      <article className={styles.shell}>
        <div
          className={`${styles.cover} ${!profile.coverMediaId ? styles.emptyCover : ""}`}
        >
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
        </div>
        <div className={styles.body}>
          <div className={styles.identity}>
            <div className={styles.avatar}>
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
            <div className={styles.name}>
              <h1 data-route-heading tabIndex={-1}>
                {profile.displayName}
              </h1>
              <Typography.Text type="secondary">
                @{profile.username}
              </Typography.Text>
              {profile.locationName ? (
                <p className={styles.location}>
                  <MapPin size={15} />
                  {profile.locationName}
                </p>
              ) : null}
            </div>
            {ownerProfile ? (
              <Button
                icon={<NotePencil size={18} />}
                onClick={() => setEditing(true)}
              >
                {text.edit}
              </Button>
            ) : null}
          </div>
          {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}
          {ownerProfile ? (
            <Modal
              open={editing}
              onCancel={() => setEditing(false)}
              footer={null}
              title={text.editHeading}
              destroyOnHidden
            >
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
                onSaved={() => {
                  dispatch(invalidateOwnProfile());
                  setEditing(false);
                }}
              />
            </Modal>
          ) : null}
          <ProfileTabController
            initialTab={initialTab}
            locale={locale}
            username={profile.username}
            owner={Boolean(ownerProfile)}
            overviewContent={
              overviewContent ?? (
                <section className="profile-overview-grid">
                  <article className="premium-card p-5">
                    <p className="premium-kicker">
                      {locale === "th" ? "พื้นที่" : "Area"}
                    </p>
                    <p>
                      {profile.locationName ??
                        (locale === "th"
                          ? "ยังไม่ระบุพื้นที่"
                          : "No area added")}
                    </p>
                  </article>
                  <article className="premium-card p-5">
                    <p className="premium-kicker">Garage</p>
                    <PendingLink
                      href={
                        ownerProfile
                          ? "/profile?tab=garage"
                          : `/users/${profile.username}?tab=garage`
                      }
                    >
                      {locale === "th" ? "เปิด Garage" : "View garage"}
                    </PendingLink>
                  </article>
                </section>
              )
            }
            tabContent={tabContent}
          />
        </div>
      </article>
    </ConfigProvider>
  );
}
