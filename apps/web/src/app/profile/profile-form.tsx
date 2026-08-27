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
    usernameRequired: "กรุณากรอกชื่อผู้ใช้",
    usernameFormat:
      "ชื่อต้องขึ้นต้นด้วยตัวอักษรหรือตัวเลข และใช้ได้เฉพาะ a-z, 0-9, _ จำนวน 3–30 ตัว",
    displayNameRequired: "กรุณากรอกชื่อที่แสดง",
    displayNameInvalid: "ชื่อที่แสดงต้องมีความยาวไม่เกิน 80 ตัวอักษร",
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
    usernameRequired: "Enter a username.",
    usernameFormat:
      "Start with a letter or number and use only a-z, 0-9, or _ (3–30 characters).",
    displayNameRequired: "Enter a display name.",
    displayNameInvalid: "Display name must be 80 characters or fewer.",
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
    fieldErrors: {},
    values: null,
  });
  const text = copy[locale];
  const error = errorMessage(state.errorCode, text);
  const usernameError = fieldErrorMessage(state.fieldErrors.username, text);
  const displayNameError = fieldErrorMessage(
    state.fieldErrors.displayName,
    text,
  );

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
          aria-describedby={`profile-username-help${usernameError ? " profile-username-error" : ""}`}
          aria-invalid={usernameError ? true : undefined}
          autoCapitalize="none"
          autoComplete="username"
          className="h-12 w-full rounded-2xl border border-border bg-background/40 px-4 font-mono text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
          defaultValue={state.values?.username ?? initialProfile.username ?? ""}
          maxLength={30}
          minLength={3}
          name="username"
          pattern="[a-zA-Z0-9][a-zA-Z0-9_]{2,29}"
          required
        />
        <span
          className="block font-normal text-muted-foreground"
          id="profile-username-help"
        >
          {text.usernameHint}
        </span>
        {usernameError ? (
          <span
            className="block font-normal text-danger"
            id="profile-username-error"
          >
            {usernameError}
          </span>
        ) : null}
      </label>

      <label className="block space-y-2 text-sm font-semibold">
        <span>{text.displayName}</span>
        <input
          aria-describedby={
            displayNameError ? "profile-display-name-error" : undefined
          }
          aria-invalid={displayNameError ? true : undefined}
          className="h-12 w-full rounded-2xl border border-border bg-background/40 px-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
          defaultValue={
            state.values?.displayName ?? initialProfile.displayName ?? ""
          }
          maxLength={80}
          name="displayName"
          required
        />
        {displayNameError ? (
          <span
            className="block font-normal text-danger"
            id="profile-display-name-error"
          >
            {displayNameError}
          </span>
        ) : null}
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
    case "PROFILE_UPDATE_FAILED":
      return text.unavailable;
    default:
      return text.unavailable;
  }
}

function fieldErrorMessage(
  code: string | undefined,
  text: (typeof copy)[Locale],
): string | null {
  switch (code) {
    case "USERNAME_REQUIRED":
      return text.usernameRequired;
    case "USERNAME_FORMAT":
      return text.usernameFormat;
    case "USERNAME_RESERVED":
      return text.usernameReserved;
    case "DISPLAY_NAME_REQUIRED":
      return text.displayNameRequired;
    case "DISPLAY_NAME_INVALID":
      return text.displayNameInvalid;
    default:
      return null;
  }
}
