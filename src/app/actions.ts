"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { insertComment, insertPost, insertVehicle, requireUser, saveProfile, setFollow, setLike } from "@/lib/data-access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, postSchema, profileSchema, vehicleSchema } from "@/lib/validators";
import type { ActionState, Locale } from "@/lib/types";

export async function signOut(locale: Locale) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(`/${locale}`);
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
      locale: parsed.data.locale,
    }, formData.get("avatar") as File | null);
    revalidatePath(`/${parsed.data.locale}/profile/${parsed.data.username}`);
    return { ok: true, message: "Profile saved" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to save profile" };
  }
}

export async function createVehicleAction(locale: Locale, formData: FormData) {
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid vehicle");
  const { supabase, user } = await requireUser();
  await insertVehicle(supabase, {
    owner_id: user.id,
    nickname: parsed.data.nickname,
    make: parsed.data.make,
    model: parsed.data.model,
    year: parsed.data.year,
    trim: parsed.data.trim || null,
    color: parsed.data.color || null,
    description: parsed.data.description || null,
  }, formData.get("cover") as File | null);
  redirect(`/${locale}/profile/me`);
}

export async function createPostAction(locale: Locale, formData: FormData) {
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid post");
  const { supabase, user } = await requireUser();
  await insertPost(supabase, {
    author_id: user.id,
    body: parsed.data.body,
    vehicle_id: parsed.data.vehicleId || null,
  }, formData.get("photo") as File | null);
  revalidatePath(`/${locale}/feed`);
  redirect(`/${locale}/feed`);
}

export async function createCommentAction(locale: Locale, postId: string, body: string): Promise<ActionState> {
  const parsed = commentSchema.safeParse({ postId, body });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  try {
    const { supabase, user } = await requireUser();
    await insertComment(supabase, { post_id: postId, author_id: user.id, body: parsed.data.body });
    revalidatePath(`/${locale}/feed`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to comment" };
  }
}

export async function toggleLikeAction(locale: Locale, postId: string, liked: boolean): Promise<ActionState> {
  try {
    const { supabase, user } = await requireUser();
    await setLike(supabase, user.id, postId, liked);
    revalidatePath(`/${locale}/feed`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update like" };
  }
}

export async function toggleFollowAction(locale: Locale, profileId: string, following: boolean): Promise<ActionState> {
  try {
    const { supabase, user } = await requireUser();
    if (user.id === profileId) return { ok: false, message: "You cannot follow yourself" };
    await setFollow(supabase, user.id, profileId, following);
    revalidatePath(`/${locale}/profile`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update follow" };
  }
}
