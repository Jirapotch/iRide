import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Bucket = "avatars" | "vehicle-media" | "post-media";
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const DEMO_MESSAGE = "Supabase environment variables are required to save changes.";
const allowedImages = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function requireUser() {
  if (!isSupabaseConfigured()) throw new Error(DEMO_MESSAGE);
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function uploadImage(supabase: SupabaseClient, file: File | null, bucket: Bucket, userId: string) {
  if (!file || file.size === 0) return null;
  if (!allowedImages.has(file.type)) throw new Error("Only JPEG, PNG, or WebP images are supported.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be smaller than 8 MB.");

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const path = `${userId}/${crypto.randomUUID()}.${extensionByMime[file.type]}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeMedia(supabase: SupabaseClient, bucket: Bucket, path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: Omit<TablesInsert<"profiles">, "id" | "avatar_path">,
  avatar: File | null,
) {
  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  const newPath = await uploadImage(supabase, avatar, "avatars", userId);
  const payload: TablesInsert<"profiles"> = { id: userId, ...profile, ...(newPath ? { avatar_path: newPath } : {}) };
  const { error } = await supabase.from("profiles").upsert(payload);
  if (error) {
    await removeMedia(supabase, "avatars", newPath).catch(() => undefined);
    throw error;
  }
  if (newPath && current?.avatar_path && current.avatar_path !== newPath) {
    await removeMedia(supabase, "avatars", current.avatar_path).catch(() => undefined);
  }
}

export async function insertVehicle(supabase: SupabaseClient, vehicle: Omit<TablesInsert<"vehicles">, "cover_path">, cover: File | null) {
  const coverPath = await uploadImage(supabase, cover, "vehicle-media", vehicle.owner_id);
  const { error } = await supabase.from("vehicles").insert({ ...vehicle, cover_path: coverPath });
  if (error) {
    await removeMedia(supabase, "vehicle-media", coverPath).catch(() => undefined);
    throw error;
  }
}

export async function insertPost(supabase: SupabaseClient, post: Omit<TablesInsert<"posts">, "photo_path">, photo: File | null) {
  const photoPath = await uploadImage(supabase, photo, "post-media", post.author_id);
  const { error } = await supabase.from("posts").insert({ ...post, photo_path: photoPath });
  if (error) {
    await removeMedia(supabase, "post-media", photoPath).catch(() => undefined);
    throw error;
  }
}

export async function insertComment(supabase: SupabaseClient, comment: TablesInsert<"comments">) {
  const { error } = await supabase.from("comments").insert(comment);
  if (error) throw error;
}

export async function setLike(supabase: SupabaseClient, userId: string, postId: string, liked: boolean) {
  const query = supabase.from("likes");
  const { error } = liked
    ? await query.delete().eq("user_id", userId).eq("post_id", postId)
    : await query.insert({ user_id: userId, post_id: postId });
  if (error) throw error;
}

export async function setFollow(supabase: SupabaseClient, userId: string, profileId: string, following: boolean) {
  const query = supabase.from("follows");
  const { error } = following
    ? await query.delete().eq("follower_id", userId).eq("following_id", profileId)
    : await query.insert({ follower_id: userId, following_id: profileId });
  if (error) throw error;
}

export async function deletePost(supabase: SupabaseClient, userId: string, postId: string) {
  const { data: post } = await supabase.from("posts").select("author_id,photo_path").eq("id", postId).maybeSingle();
  if (!post || post.author_id !== userId) throw new Error("Post not found");
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", userId);
  if (error) throw error;
  await removeMedia(supabase, "post-media", post.photo_path).catch(() => undefined);
}

export async function deleteVehicle(supabase: SupabaseClient, userId: string, vehicleId: string) {
  const { data: vehicle } = await supabase.from("vehicles").select("owner_id,cover_path").eq("id", vehicleId).maybeSingle();
  if (!vehicle || vehicle.owner_id !== userId) throw new Error("Vehicle not found");
  const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId).eq("owner_id", userId);
  if (error) throw error;
  await removeMedia(supabase, "vehicle-media", vehicle.cover_path).catch(() => undefined);
}
