"use server";

import type { UpdateProfileInput } from "@iride/types";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { ProfileApiError, updateOwnProfile } from "@/lib/profile-api";

import type { ProfileFormState } from "./profile-form-state";

export async function completeOnboarding(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return saveProfile(formData, true);
}

export async function editProfile(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return saveProfile(formData, false);
}

async function saveProfile(
  formData: FormData,
  onboarding: boolean,
): Promise<ProfileFormState> {
  const session = await getVerifiedWebSession();
  if (!session)
    redirect(
      `/login?next=${onboarding ? "%2Fonboarding" : "%2Fprofile%2Fedit"}`,
    );

  const input: UpdateProfileInput = {
    username: field(formData, "username"),
    displayName: field(formData, "displayName"),
    bio: nullableField(formData, "bio"),
    locationName: nullableField(formData, "locationName"),
    visibility: visibilityField(formData),
  };
  const values = {
    username: input.username ?? "",
    displayName: input.displayName ?? "",
    bio: input.bio ?? "",
    locationName: input.locationName ?? "",
    visibility: input.visibility ?? "public",
  } as const;

  let username: string;
  try {
    const profile = await updateOwnProfile(session.accessToken, input);
    if (!profile.isComplete || !profile.username) {
      return { errorCode: "PROFILE_INCOMPLETE", values };
    }
    username = profile.username;
  } catch (error) {
    return {
      errorCode:
        error instanceof ProfileApiError ? error.code : "AUTH_PROVIDER_ERROR",
      values,
    };
  }

  redirect(onboarding ? `/users/${username}` : "/account");
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function nullableField(formData: FormData, name: string): string | null {
  const value = field(formData, name).trim();
  return value || null;
}

function visibilityField(
  formData: FormData,
): "public" | "followers" | "private" {
  const value = field(formData, "visibility");
  return value === "followers" || value === "private" ? value : "public";
}
