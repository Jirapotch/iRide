"use client";

import type { OwnProfileDto } from "@iride/types";
import { useActionState } from "react";

import type { Locale } from "@/lib/locale";

import type { ProfileFormState } from "./profile-form-state";

const copy = {
  th: {
    username: "ชื่อผู้ใช้",
    usernameHint: "ใช้ตัวอักษรอังกฤษ ตัวเลข และ _ จำนวน 3–30 ตัว",
    displayName: "ชื่อที่แสดง",
    bio: "แนะนำตัว",
    location: "พื้นที่หรือเมือง",
    visibility: "การมองเห็นโปรไฟล์",
    public: "สาธารณะ",
    followers: "ผู้ติดตาม (ขณะนี้มองเห็นแบบสาธารณะ)",
    private: "ส่วนตัว",
    save: "บันทึกโปรไฟล์",
    saving: "กำลังบันทึก…",
    usernameTaken: "ชื่อผู้ใช้นี้ถูกใช้แล้ว",
    usernameReserved: "ชื่อผู้ใช้นี้สงวนไว้",
    usernameCooldown: "ยังเปลี่ยนชื่อผู้ใช้ไม่ได้ กรุณารอให้ครบ 30 วัน",
    invalid: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
    unavailable: "ระบบโปรไฟล์ยังไม่พร้อม กรุณาลองใหม่",
  },
  en: {
    username: "Username",
    usernameHint: "Use 3–30 lowercase letters, numbers, and underscores.",
    displayName: "Display name",
    bio: "Bio",
    location: "Area or city",
    visibility: "Profile visibility",
    public: "Public",
    followers: "Followers (temporarily public)",
    private: "Private",
    save: "Save profile",
    saving: "Saving…",
    usernameTaken: "That username is already in use.",
    usernameReserved: "That username is reserved.",
    usernameCooldown:
      "Your username cannot be changed until 30 days have passed.",
    invalid: "Please check the profile information and try again.",
    unavailable: "Profiles are currently unavailable. Please try again.",
  },
} as const;

export function ProfileForm({
  action,
  initialProfile,
  locale,
}: {
  readonly action: (
    state: ProfileFormState,
    formData: FormData,
  ) => Promise<ProfileFormState>;
  readonly initialProfile: OwnProfileDto;
  readonly locale: Locale;
}) {
  const [state, formAction, pending] = useActionState(action, {
    errorCode: null,
    values: null,
  });
  const text = copy[locale];
  const error = errorMessage(state.errorCode, text);

  return (
    <form action={formAction} className="space-y-5">
      {error ? (
        <p
          className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <label className="block space-y-2 text-sm font-semibold">
        <span>{text.username}</span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="h-12 w-full rounded-2xl border border-border bg-background/40 px-4 font-mono text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
          defaultValue={state.values?.username ?? initialProfile.username ?? ""}
          maxLength={30}
          minLength={3}
          name="username"
          pattern="[a-zA-Z0-9_]{3,30}"
          required
        />
        <span className="block font-normal text-muted-foreground">
          {text.usernameHint}
        </span>
      </label>

      <label className="block space-y-2 text-sm font-semibold">
        <span>{text.displayName}</span>
        <input
          className="h-12 w-full rounded-2xl border border-border bg-background/40 px-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
          defaultValue={
            state.values?.displayName ?? initialProfile.displayName ?? ""
          }
          maxLength={80}
          name="displayName"
          required
        />
      </label>

      <label className="block space-y-2 text-sm font-semibold">
        <span>{text.bio}</span>
        <textarea
          className="min-h-32 w-full resize-y rounded-2xl border border-border bg-background/40 px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
          defaultValue={state.values?.bio ?? initialProfile.bio ?? ""}
          maxLength={500}
          name="bio"
        />
      </label>

      <label className="block space-y-2 text-sm font-semibold">
        <span>{text.location}</span>
        <input
          className="h-12 w-full rounded-2xl border border-border bg-background/40 px-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
          defaultValue={
            state.values?.locationName ?? initialProfile.locationName ?? ""
          }
          maxLength={120}
          name="locationName"
        />
      </label>

      <label className="block space-y-2 text-sm font-semibold">
        <span>{text.visibility}</span>
        <select
          className="h-12 w-full rounded-2xl border border-border bg-background/40 px-4 text-foreground outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
          defaultValue={state.values?.visibility ?? initialProfile.visibility}
          name="visibility"
        >
          <option value="public">{text.public}</option>
          <option value="followers">{text.followers}</option>
          <option value="private">{text.private}</option>
        </select>
      </label>

      <button
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-45"
        disabled={pending}
        type="submit"
      >
        {pending ? text.saving : text.save}
      </button>
    </form>
  );
}

function errorMessage(
  code: string | null,
  text: (typeof copy)[Locale],
): string | null {
  switch (code) {
    case null:
      return null;
    case "USERNAME_TAKEN":
      return text.usernameTaken;
    case "USERNAME_RESERVED":
      return text.usernameReserved;
    case "USERNAME_COOLDOWN":
      return text.usernameCooldown;
    case "PROFILE_VALIDATION_FAILED":
    case "PROFILE_INCOMPLETE":
      return text.invalid;
    default:
      return text.unavailable;
  }
}
