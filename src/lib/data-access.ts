import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { processUploadedImage } from "@/lib/image-processing";
import { getR2MediaStorage, parseMediaPath, toR2Path, type MediaBucket } from "@/lib/media-storage";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const DEMO_MESSAGE = "Supabase environment variables are required to save changes.";

export async function requireUser() {
  if (!isSupabaseConfigured()) throw new Error(DEMO_MESSAGE);
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function uploadImage(_supabase: SupabaseClient, file: File | null, bucket: MediaBucket, userId: string) {
  if (!file || file.size === 0) return null;
  const processed = await processUploadedImage(file);
  const path = `${userId}/${crypto.randomUUID()}.${processed.extension}`;
  await getR2MediaStorage().upload(bucket, path, processed.data, processed.contentType);
  return toR2Path(path);
}

export async function removeMedia(supabase: SupabaseClient, bucket: MediaBucket, path: string | null | undefined) {
  if (!path) return;
  const media = parseMediaPath(path);
  if (media.provider === "r2") {
    await getR2MediaStorage().remove(bucket, media.key);
    return;
  }
  const { error } = await supabase.storage.from(bucket).remove([media.key]);
  if (error) throw error;
}

export async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: Omit<TablesInsert<"profiles">, "id" | "avatar_path" | "cover_path">,
  avatar: File | null,
  cover: File | null,
) {
  const { data: current } = await supabase.from("profiles").select("avatar_path,cover_path").eq("id", userId).maybeSingle();
  let newAvatarPath: string | null = null;
  let newCoverPath: string | null = null;
  try {
    newAvatarPath = await uploadImage(supabase, avatar, "avatars", userId);
    newCoverPath = await uploadImage(supabase, cover, "avatars", userId);
  } catch (error) {
    await Promise.all([
      removeMedia(supabase, "avatars", newAvatarPath).catch(() => undefined),
      removeMedia(supabase, "avatars", newCoverPath).catch(() => undefined),
    ]);
    throw error;
  }
  const payload: TablesInsert<"profiles"> = {
    id: userId,
    ...profile,
    ...(newAvatarPath ? { avatar_path: newAvatarPath } : {}),
    ...(newCoverPath ? { cover_path: newCoverPath } : {}),
  };
  const { error } = await supabase.from("profiles").upsert(payload);
  if (error) {
    await Promise.all([
      removeMedia(supabase, "avatars", newAvatarPath).catch(() => undefined),
      removeMedia(supabase, "avatars", newCoverPath).catch(() => undefined),
    ]);
    throw error;
  }
  await Promise.all([
    newAvatarPath && current?.avatar_path && current.avatar_path !== newAvatarPath
      ? removeMedia(supabase, "avatars", current.avatar_path).catch(() => undefined)
      : Promise.resolve(),
    newCoverPath && current?.cover_path && current.cover_path !== newCoverPath
      ? removeMedia(supabase, "avatars", current.cover_path).catch(() => undefined)
      : Promise.resolve(),
  ]);
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

export async function setFollow(supabase: SupabaseClient, userId: string, profileId: string, remove: boolean) {
  if (remove) {
    const { error } = await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", profileId);
    if (error) throw error;
    return "none" as const;
  }
  const { data: profile, error: profileError } = await supabase.from("profiles").select("is_private").eq("id", profileId).single();
  if (profileError) throw profileError;
  const status = profile.is_private ? "pending" : "accepted";
  const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: profileId, status });
  if (error) throw error;
  return status;
}

export async function updatePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  post: Pick<TablesInsert<"posts">, "body" | "vehicle_id">,
  photo: File | null,
) {
  const { data: current } = await supabase.from("posts").select("author_id,photo_path").eq("id", postId).maybeSingle();
  if (!current || current.author_id !== userId) throw new Error("Post not found");
  const newPhotoPath = await uploadImage(supabase, photo, "post-media", userId);
  const { error } = await supabase.from("posts").update({ ...post, ...(newPhotoPath ? { photo_path: newPhotoPath } : {}) }).eq("id", postId).eq("author_id", userId);
  if (error) {
    await removeMedia(supabase, "post-media", newPhotoPath).catch(() => undefined);
    throw error;
  }
  if (newPhotoPath && current.photo_path !== newPhotoPath) await removeMedia(supabase, "post-media", current.photo_path).catch(() => undefined);
}

export async function updateVehicle(
  supabase: SupabaseClient,
  userId: string,
  vehicleId: string,
  vehicle: Pick<TablesInsert<"vehicles">, "nickname" | "make" | "model" | "year" | "trim" | "color" | "description">,
  cover: File | null,
) {
  const { data: current } = await supabase.from("vehicles").select("owner_id,cover_path").eq("id", vehicleId).maybeSingle();
  if (!current || current.owner_id !== userId) throw new Error("Vehicle not found");
  const newCoverPath = await uploadImage(supabase, cover, "vehicle-media", userId);
  const { error } = await supabase.from("vehicles").update({ ...vehicle, ...(newCoverPath ? { cover_path: newCoverPath } : {}) }).eq("id", vehicleId).eq("owner_id", userId);
  if (error) {
    await removeMedia(supabase, "vehicle-media", newCoverPath).catch(() => undefined);
    throw error;
  }
  if (newCoverPath && current.cover_path !== newCoverPath) await removeMedia(supabase, "vehicle-media", current.cover_path).catch(() => undefined);
}

export async function respondToFollowRequest(supabase: SupabaseClient, userId: string, followerId: string, accept: boolean) {
  const { error } = accept
    ? await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", followerId).eq("following_id", userId).eq("status", "pending")
    : await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", userId).eq("status", "pending");
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
