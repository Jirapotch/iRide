"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, postSchema, profileSchema, vehicleSchema } from "@/lib/validators";
import type { ActionState, Locale } from "@/lib/types";

const DEMO_MESSAGE = "Supabase environment variables are required to save changes.";
const allowedImages = new Set(["image/jpeg", "image/png", "image/webp"]);

async function requireUser() {
  if (!isSupabaseConfigured()) throw new Error(DEMO_MESSAGE);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function uploadImage(file: File | null, bucket: "avatars" | "vehicle-media" | "post-media", userId: string) {
  if (!file || file.size === 0) return null;
  if (!allowedImages.has(file.type)) throw new Error("Only JPEG, PNG, or WebP images are supported.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be smaller than 8 MB.");
  const { supabase } = await requireUser();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  if (bucket === "post-media") return path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

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
    const avatarUrl = await uploadImage(formData.get("avatar") as File | null, "avatars", user.id);
    const payload = { username: parsed.data.username, display_name: parsed.data.displayName, bio: parsed.data.bio || null, location: parsed.data.location || null, locale: parsed.data.locale, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) };
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...payload });
    if (error) throw error;
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
  const coverUrl = await uploadImage(formData.get("cover") as File | null, "vehicle-media", user.id);
  const { error } = await supabase.from("vehicles").insert({ owner_id: user.id, nickname: parsed.data.nickname, make: parsed.data.make, model: parsed.data.model, year: parsed.data.year, trim: parsed.data.trim || null, color: parsed.data.color || null, description: parsed.data.description || null, cover_url: coverUrl });
  if (error) throw error;
  redirect(`/${locale}/profile/me`);
}

export async function createPostAction(locale: Locale, formData: FormData) {
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid post");
  const { supabase, user } = await requireUser();
  const photoUrl = await uploadImage(formData.get("photo") as File | null, "post-media", user.id);
  const { error } = await supabase.from("posts").insert({ author_id: user.id, body: parsed.data.body, vehicle_id: parsed.data.vehicleId || null, photo_url: photoUrl });
  if (error) throw error;
  revalidatePath(`/${locale}/feed`);
  redirect(`/${locale}/feed`);
}

export async function createCommentAction(locale: Locale, postId: string, body: string): Promise<ActionState> {
  const parsed = commentSchema.safeParse({ postId, body });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: user.id, body: parsed.data.body });
    if (error) throw error;
    revalidatePath(`/${locale}/feed`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to comment" };
  }
}

export async function toggleLikeAction(locale: Locale, postId: string, liked: boolean): Promise<ActionState> {
  try {
    const { supabase, user } = await requireUser();
    const query = supabase.from("likes");
    const { error } = liked ? await query.delete().eq("user_id", user.id).eq("post_id", postId) : await query.insert({ user_id: user.id, post_id: postId });
    if (error) throw error;
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
    const query = supabase.from("follows");
    const { error } = following ? await query.delete().eq("follower_id", user.id).eq("following_id", profileId) : await query.insert({ follower_id: user.id, following_id: profileId });
    if (error) throw error;
    revalidatePath(`/${locale}/profile`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update follow" };
  }
}
