import "server-only";

import { cache } from "react";
import { demoPosts, demoProfile, demoVehicles } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Comment, Post, Profile, Vehicle } from "@/lib/types";

export const getViewer = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export async function getFeed(): Promise<Post[]> {
  if (!isSupabaseConfigured()) return demoPosts;
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data, error } = await supabase
    .from("posts")
    .select("id,body,photo_path,created_at,profiles!posts_author_id_fkey(username,display_name,avatar_path),vehicles(id,nickname,make,model,year),likes(count),comments(count)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  const postIds = data.map((row) => row.id);
  const { data: viewerLikes } = viewer && postIds.length
    ? await supabase.from("likes").select("post_id").eq("user_id", viewer.id).in("post_id", postIds)
    : { data: [] };
  const likedPostIds = new Set((viewerLikes ?? []).map((like) => like.post_id));
  return Promise.all(data.map(async (row: Record<string, unknown>) => {
    const path = row.photo_path ? String(row.photo_path) : null;
    const { data: signed } = path
      ? await supabase.storage.from("post-media").createSignedUrl(path, 60 * 60)
      : { data: null };
    const author = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Record<string, string | null> | null;
    return mapPost(
      row,
      signed?.signedUrl ?? null,
      publicMediaUrl(supabase, "avatars", author?.avatar_path),
      likedPostIds.has(String(row.id)),
    );
  }));
}

export async function getPost(id: string): Promise<Post | null> {
  const post = (await getFeed()).find((item) => item.id === id);
  if (!post || !isSupabaseConfigured()) return post ?? null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("id,body,created_at,profiles!comments_author_id_fkey(username,display_name,avatar_path)")
    .eq("post_id", id)
    .order("created_at", { ascending: true });
  const comments: Comment[] = (data ?? []).map((row) => {
    const author = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Record<string, string | null> | null;
    return { id: row.id, body: row.body, createdAt: row.created_at, author: { username: author?.username ?? "driver", displayName: author?.display_name ?? "iRide driver", avatarUrl: publicMediaUrl(supabase, "avatars", author?.avatar_path) } };
  });
  return { ...post, comments };
}

export async function getPublicProfile(username: string): Promise<{ profile: Profile; vehicles: Vehicle[] } | null> {
  if (!isSupabaseConfigured()) {
    return username === demoProfile.username ? { profile: demoProfile, vehicles: demoVehicles } : null;
  }
  const supabase = await createClient();
  const { data: profileRow } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  if (!profileRow) return null;
  const { data: vehicleRows } = await supabase.from("vehicles").select("*").eq("owner_id", profileRow.id).order("created_at");
  const { data: stats } = await supabase.rpc("profile_stats", { target: profileRow.id }).maybeSingle();
  const profileStats = stats as { followers_count?: number; following_count?: number } | null;
  const profile: Profile = {
    id: profileRow.id, username: profileRow.username, displayName: profileRow.display_name, bio: profileRow.bio, location: profileRow.location, avatarUrl: publicMediaUrl(supabase, "avatars", profileRow.avatar_path), locale: profileRow.locale as Profile["locale"], followersCount: profileStats?.followers_count ?? 0, followingCount: profileStats?.following_count ?? 0,
  };
  const vehicles: Vehicle[] = (vehicleRows ?? []).map((v) => ({
    id: v.id, ownerId: v.owner_id, nickname: v.nickname, make: v.make, model: v.model, year: v.year, trim: v.trim, color: v.color, description: v.description, coverUrl: publicMediaUrl(supabase, "vehicle-media", v.cover_path),
  }));
  return { profile, vehicles };
}

export async function getMyVehicles(): Promise<Vehicle[]> {
  const viewer = await getViewer();
  if (!viewer) return isSupabaseConfigured() ? [] : demoVehicles;
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*").eq("owner_id", viewer.id).order("created_at");
  return (data ?? []).map((v) => ({ id: v.id, ownerId: v.owner_id, nickname: v.nickname, make: v.make, model: v.model, year: v.year, trim: v.trim, color: v.color, description: v.description, coverUrl: publicMediaUrl(supabase, "vehicle-media", v.cover_path) }));
}

function publicMediaUrl(supabase: Awaited<ReturnType<typeof createClient>>, bucket: "avatars" | "vehicle-media", path: string | null | undefined) {
  return path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
}

function mapPost(
  row: Record<string, unknown>,
  photoUrl = row.photo_path ? String(row.photo_path) : null,
  avatarUrl: string | null = null,
  likedByViewer = false,
): Post {
  const author = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Record<string, string | null> | null;
  const vehicle = (Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles) as Record<string, string | number> | null;
  const likes = row.likes as Array<{ count: number }> | undefined;
  const comments = row.comments as Array<{ count: number }> | undefined;
  return {
    id: String(row.id), body: String(row.body), photoUrl, createdAt: String(row.created_at),
    author: { username: author?.username ?? "driver", displayName: author?.display_name ?? "iRide driver", avatarUrl },
    vehicle: vehicle ? { id: String(vehicle.id), nickname: String(vehicle.nickname), make: String(vehicle.make), model: String(vehicle.model), year: Number(vehicle.year) } : null,
    likesCount: likes?.[0]?.count ?? 0, commentsCount: comments?.[0]?.count ?? 0, likedByViewer,
  };
}
