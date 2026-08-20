"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { insertComment, insertPost, insertVehicle, requireUser, respondToFollowRequest, saveProfile, setFollow, setLike } from "@/lib/data-access";
import { isLocale, localeStorageKey } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, postSchema, profileSchema, vehicleSchema } from "@/lib/validators";
import type { ActionState } from "@/lib/types";

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/");
}

export async function updateProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const { supabase, user } = await requireUser();
    await saveProfile(supabase, user.id, {
      username: parsed.data.username,
      display_name: parsed.data.displayName,
      bio: parsed.data.bio || null,
      location: parsed.data.location || null,
      onboarding_completed: true,
    }, formData.get("avatar") as File | null, formData.get("cover") as File | null);
    revalidatePath("/", "layout");
    revalidatePath("/feed");
    revalidatePath("/settings/profile");
    revalidatePath(`/profile/${parsed.data.username}`);
  } catch (error) {
    const candidate = error as { code?: string; message?: string };
    if (candidate.code === "23505") return { ok: false, message: "Username นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อใหม่" };
    return { ok: false, message: candidate.message ?? "Unable to save profile" };
  }
  redirect(`/profile/${parsed.data.username}`);
}

export async function createVehicleAction(formData: FormData) {
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid vehicle");
  const { supabase, user } = await requireUser();
  await insertVehicle(supabase, {
    owner_id: user.id,
    nickname: parsed.data.name,
    make: parsed.data.brand || null,
    model: parsed.data.model || null,
    year: null,
    trim: null,
    color: parsed.data.color || null,
    description: parsed.data.description || null,
  }, formData.get("cover") as File | null);
  redirect("/profile/me");
}

export async function createPostAction(formData: FormData) {
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid post");
  const { supabase, user } = await requireUser();
  await insertPost(supabase, {
    author_id: user.id,
    body: parsed.data.body,
    vehicle_id: parsed.data.vehicleId || null,
  }, formData.get("photo") as File | null);
  revalidatePath("/feed");
  redirect("/feed");
}

export async function createCommentAction(postId: string, body: string): Promise<ActionState> {
  const parsed = commentSchema.safeParse({ postId, body });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  try {
    const { supabase, user } = await requireUser();
    await insertComment(supabase, { post_id: postId, author_id: user.id, body: parsed.data.body });
    revalidatePath("/feed");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to comment" };
  }
}

export async function toggleLikeAction(postId: string, liked: boolean): Promise<ActionState> {
  try {
    const { supabase, user } = await requireUser();
    await setLike(supabase, user.id, postId, liked);
    revalidatePath("/feed");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update like" };
  }
}

export async function toggleFollowAction(profileId: string, currentStatus: "none" | "pending" | "accepted"): Promise<ActionState> {
  try {
    const { supabase, user } = await requireUser();
    if (user.id === profileId) return { ok: false, message: "You cannot follow yourself" };
    const followStatus = await setFollow(supabase, user.id, profileId, currentStatus !== "none");
    revalidatePath("/profile/[username]", "page");
    revalidatePath("/feed");
    return { ok: true, followStatus };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update follow" };
  }
}

export async function updatePrivacyAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ is_private: formData.get("isPrivate") === "on" }).eq("id", user.id);
  if (error) throw error;
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/feed");
}

export async function updateLocaleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const locale = formData.get("locale");
  if (typeof locale !== "string" || !isLocale(locale)) return { ok: false, message: "Unsupported language" };
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("profiles").update({ locale }).eq("id", user.id);
    if (error) throw error;
    (await cookies()).set(localeStorageKey, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
    revalidatePath("/", "layout");
    return { ok: true, locale };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to change language" };
  }
}

export async function respondToFollowRequestAction(followerId: string, decision: "accept" | "reject") {
  const { supabase, user } = await requireUser();
  await respondToFollowRequest(supabase, user.id, followerId, decision === "accept");
  revalidatePath("/settings");
  revalidatePath("/profile/[username]", "page");
}
