"use client";

import {
  CalendarBlank,
  Camera,
  Car,
  MapPin,
  NotePencil,
  Path,
  Plus,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import { buttonVariants } from "@iride/ui/button";
import type {
  ExploreFeatureDto,
  OwnProfileDto,
  PublicProfileDto,
  VehicleDto,
  VehicleKind,
} from "@iride/types";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { attachProfileMediaAction } from "../../media-actions";
import { ProfileForm } from "../../profile/profile-form";
import { editProfile } from "../../profile/actions";
import { mediaVariantUrl } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";
import { EditModal } from "../../(main)/_components/edit-modal";
import { ActionSubmitButton } from "../../(main)/_components/action-submit-button";
import {
  removeVehicleAction,
  saveVehicleAction,
} from "../../(main)/create/actions";
import { MediaUploader } from "./media-uploader";

interface Props {
  readonly activities: readonly ExploreFeatureDto[];
  readonly canManage: boolean;
  readonly initialTab?: string;
  readonly locale: Locale;
  readonly modal?: string;
  readonly ownerProfile: OwnProfileDto | null;
  readonly profile: PublicProfileDto;
  readonly selectedVehicleId?: string;
  readonly vehicles: readonly VehicleDto[];
}
export function UserProfileScreen({
  activities,
  canManage,
  initialTab,
  locale,
  modal,
  ownerProfile,
  profile,
  selectedVehicleId,
  vehicles,
}: Props) {
  const router = useRouter(),
    [editing, setEditing] = useState(false),
    tab =
      initialTab === "garage" || initialTab === "activities"
        ? initialTab
        : "overview",
    initials = profile.displayName.slice(0, 2).toUpperCase();
  const selected = selectedVehicleId
      ? (vehicles.find(
          (item) => item.id === selectedVehicleId && item.canEdit,
        ) ?? null)
      : null,
    showVehicleModal = Boolean(
      (modal === "create-vehicle" && ownerProfile?.canWrite) ||
      (modal === "edit" && selected && (ownerProfile?.canWrite || canManage)),
    );
  const vehicleEditDenied = Boolean(
    modal === "edit" && selectedVehicleId && !selected,
  );
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
          addVehicle: "เพิ่ม Vehicle",
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
          addVehicle: "Add vehicle",
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
          <div aria-label="Profile cover placeholder" className="profile-cover-placeholder" role="img" />
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
            {ownerProfile.canWrite ? <div className="profile-media-editors">
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
            </div> : null}
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
                <h1>{profile.displayName}</h1>
                <p className="font-mono text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
              {ownerProfile ? (
                <button
                  className={buttonVariants()}
                  onClick={() => setEditing(true)}
                  type="button"
                >
                  {text.edit}
                </button>
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
                <Link
                  aria-current={tab === value ? "page" : undefined}
                  href={`/users/${profile.username}${value === "overview" ? "" : `?tab=${value}`}`}
                  key={value}
                >
                  {text[value]}
                </Link>
              ))}
            </nav>
            {tab === "overview" ? (
              <section className="profile-overview-grid">
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
                  <strong>{vehicles.length} Vehicles</strong>
                </article>
              </section>
            ) : null}
            {tab === "garage" ? (
              <GaragePanel
                locale={locale}
                canCreate={ownerProfile?.canWrite ?? false}
                username={profile.username}
                vehicles={vehicles}
              />
            ) : null}
            {tab === "activities" ? (
              <ProfileActivities activities={activities} locale={locale} />
            ) : null}
          </>
        )}
        {showVehicleModal ? (
          <EditModal
            closeUrl={`/users/${profile.username}?tab=garage${selected ? `&vehicle=${selected.id}` : ""}`}
            title={
              selected
                ? locale === "th"
                  ? "แก้ไข Vehicle"
                  : "Edit vehicle"
                : locale === "th"
                  ? "เพิ่ม Vehicle"
                  : "Add vehicle"
            }
          >
            <VehicleForm
              initial={selected}
              locale={locale}
              username={profile.username}
            />
          </EditModal>
        ) : null}
        {vehicleEditDenied ? (
          <div className="permission-toast" role="alert">
            {locale === "th"
              ? "คุณไม่มีสิทธิ์แก้ไข Vehicle นี้"
              : "You do not have permission to edit this vehicle."}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ProfileActivities({
  activities,
  locale,
}: {
  readonly activities: readonly ExploreFeatureDto[];
  readonly locale: Locale;
}) {
  if (!activities.length)
    return (
      <section className="empty-state">
        <strong>
          {locale === "th"
            ? "ยังไม่มีกิจกรรมที่เผยแพร่"
            : "No published activities yet"}
        </strong>
        <Link href="/maps">{locale === "th" ? "เปิดแผนที่" : "Open map"}</Link>
      </section>
    );
  return (
    <section className="profile-activity-grid">
      {activities.map((activity) => {
        const Icon =
          activity.kind === "meeting"
            ? UsersThree
            : activity.kind === "event"
              ? CalendarBlank
              : activity.kind === "trip"
                ? Path
                : Camera;
        return (
          <Link
            className="premium-card profile-activity-card"
            href={`/maps?marker=${activity.id}`}
            key={`${activity.kind}:${activity.id}`}
          >
            <Icon size={24} />
            <div>
              <span className={`kind-badge kind-${activity.kind}`}>
                {activity.kind}
              </span>
              <h3>{activity.title}</h3>
              <p>
                <MapPin size={15} />
                {activity.subtitle}
              </p>
              <time dateTime={activity.startsAt}>
                {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(activity.startsAt))}
              </time>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function GaragePanel({
  canCreate,
  locale,
  username,
  vehicles,
}: {
  readonly locale: Locale;
  readonly canCreate: boolean;
  readonly username: string;
  readonly vehicles: readonly VehicleDto[];
}) {
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="premium-kicker">Garage</p>
          <h2>{locale === "th" ? "Vehicle" : "Vehicles"}</h2>
        </div>
        {canCreate ? (
          <Link
            className={buttonVariants()}
            href={`/users/${username}?tab=garage&modal=create-vehicle`}
          >
            <Plus size={17} />
            {locale === "th" ? "เพิ่ม" : "Add"}
          </Link>
        ) : null}
      </div>
      <div className="vehicle-grid">
        {vehicles.map((vehicle) => (
          <article className="vehicle-card premium-card" key={vehicle.id}>
            {vehicle.mediaIds[0] ? (
              <Image
                alt={`${vehicle.brand} ${vehicle.model}`}
                height={720}
                src={mediaVariantUrl(vehicle.mediaIds[0], "preview")}
                unoptimized
                width={1280}
              />
            ) : (
              <div className="vehicle-placeholder">
                <Car size={42} />
              </div>
            )}
            <div>
              <span className="kind-badge kind-meeting">{vehicle.kind}</span>
              <h3>
                {vehicle.brand} {vehicle.model}
              </h3>
              <p>
                {[vehicle.nickname, vehicle.year].filter(Boolean).join(" · ")}
              </p>
              {vehicle.canEdit ? (
                <div className="owner-actions">
                  <Link
                    href={`/users/${username}?tab=garage&vehicle=${vehicle.id}&modal=edit`}
                  >
                    <NotePencil size={16} />
                    {locale === "th" ? "แก้ไข" : "Edit"}
                  </Link>
                  <form
                    action={removeVehicleAction}
                    onSubmit={(event) => {
                      if (
                        !confirm(
                          locale === "th"
                            ? "ลบ Vehicle และรูปทั้งหมดถาวรหรือไม่?"
                            : "Permanently delete this vehicle and all its images?",
                        )
                      )
                        event.preventDefault();
                    }}
                  >
                    <input name="id" type="hidden" value={vehicle.id} />
                    <input name="username" type="hidden" value={username} />
                    <button type="submit">
                      <Trash size={16} />
                      {locale === "th" ? "ลบ" : "Delete"}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {!vehicles.length ? (
        <div className="empty-state">
          {locale === "th"
            ? "ยังไม่มี Vehicle ใน Garage"
            : "No vehicles in this garage"}
        </div>
      ) : null}
    </section>
  );
}

function VehicleForm({
  initial,
  locale,
  username,
}: {
  readonly initial: VehicleDto | null;
  readonly locale: Locale;
  readonly username: string;
}) {
  const [mediaIds, setMediaIds] = useState<string[]>([
    ...(initial?.mediaIds ?? []),
  ]);
  return (
    <form action={saveVehicleAction} className="form-stack">
      <input name="username" type="hidden" value={username} />
      {initial ? (
        <input name="editId" type="hidden" value={initial.id} />
      ) : null}
      {mediaIds.map((id) => (
        <input key={id} name="mediaIds" type="hidden" value={id} />
      ))}
      <label className="form-field">
        <span>{locale === "th" ? "ประเภท" : "Kind"}</span>
        <select defaultValue={initial?.kind ?? "car"} name="kind">
          {(["car", "motorcycle", "bicycle"] as VehicleKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>{locale === "th" ? "ยี่ห้อ" : "Brand"}</span>
        <input defaultValue={initial?.brand ?? ""} name="brand" required />
      </label>
      <label className="form-field">
        <span>{locale === "th" ? "รุ่น" : "Model"}</span>
        <input defaultValue={initial?.model ?? ""} name="model" required />
      </label>
      <label className="form-field">
        <span>{locale === "th" ? "ปี" : "Year"}</span>
        <input
          defaultValue={initial?.year ?? ""}
          max="2100"
          min="1886"
          name="year"
          type="number"
        />
      </label>
      <label className="form-field">
        <span>{locale === "th" ? "ชื่อเล่น" : "Nickname"}</span>
        <input defaultValue={initial?.nickname ?? ""} name="nickname" />
      </label>
      <label className="form-field">
        <span>{locale === "th" ? "รายละเอียด" : "Description"}</span>
        <textarea
          defaultValue={initial?.description ?? ""}
          name="description"
        />
      </label>
      <label className="form-field">
        <span>{locale === "th" ? "การมองเห็น" : "Visibility"}</span>
        <select
          defaultValue={initial?.visibility ?? "public"}
          name="visibility"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>
      {mediaIds.length < 8 ? (
        <MediaUploader
          locale={locale}
          onReady={(id) => setMediaIds((items) => [...items, id])}
          purpose="vehicle"
        />
      ) : (
        <p className="form-hint" role="status">
          {locale === "th"
            ? "แนบรูปได้สูงสุด 8 รูป ลบรูปเดิมก่อนเพิ่มรูปใหม่"
            : "You can attach up to 8 images. Remove one before uploading another."}
        </p>
      )}
      <div className="media-id-list">
        {mediaIds.map((id) => (
          <button
            key={id}
            onClick={() =>
              setMediaIds((items) => items.filter((item) => item !== id))
            }
            type="button"
          >
            <Image
              alt="Vehicle upload"
              height={80}
              src={mediaVariantUrl(id, "thumbnail")}
              unoptimized
              width={120}
            />
            ×
          </button>
        ))}
      </div>
      <ActionSubmitButton
        pendingLabel={locale === "th" ? "กำลังบันทึก…" : "Saving…"}
      >
        {initial
          ? locale === "th"
            ? "บันทึก"
            : "Save"
          : locale === "th"
            ? "เพิ่ม Vehicle"
            : "Add vehicle"}
      </ActionSubmitButton>
    </form>
  );
}
