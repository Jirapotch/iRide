import "server-only";

import { cache } from "react";
import { demoPosts, demoProfile, demoVehicles } from "@/lib/demo-data";
import { resolveAvatarUrl } from "@/lib/profile-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Comment, MemberProfile, Post, Profile, Vehicle, ViewerContext } from "@/lib/types";

export const getViewer = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getViewerContext = cache(async (): Promise<ViewerContext | null> => {
  const user = await getViewer();
  if (!user) return null;
  const supabase = await createClient();
  const { data: row } = await supabase.from("profiles").select("id,username,display_name,avatar_path,provider_avatar_url,onboarding_completed").eq("id", user.id).maybeSingle();
  if (!row) return { id: user.id, username: null, displayName: user.user_metadata.full_name ?? "New driver", avatarUrl: null, onboardingCompleted: false, followersCount: 0, vehicleCount: 0 };
  const [{ data: stats }, { count: vehicleCount }] = await Promise.all([
    supabase.rpc("profile_stats", { target: user.id }).maybeSingle(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);
  return { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: resolveAvatarUrl(publicMediaUrl(supabase, "avatars", row.avatar_path), row.provider_avatar_url), onboardingCompleted: row.onboarding_completed, followersCount: stats?.followers_count ?? 0, vehicleCount: vehicleCount ?? 0 };
});

export async function getFeed(): Promise<Post[]> {
  if (!isSupabaseConfigured()) return demoPosts;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feed_posts", { feed_limit: 20 });
  if (error || !data) return [];
  const paths = data.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const admin = createAdminClient();
    const { data: signed } = admin
      ? await admin.storage.from("post-media").createSignedUrls(paths, 3600)
      : { data: null };
    signed?.forEach((item, index) => { if (item.signedUrl) signedByPath.set(paths[index], item.signedUrl); });
  }
  return data.map((row) => ({
    id: row.id, body: row.body, photoUrl: row.photo_path ? signedByPath.get(row.photo_path) ?? null : null, createdAt: row.created_at,
    author: { username: row.author_username, displayName: row.author_display_name, avatarUrl: resolveAvatarUrl(publicMediaUrl(supabase, "avatars", row.author_avatar_path), row.author_provider_avatar_url) },
    vehicle: row.vehicle_id ? { id: row.vehicle_id, nickname: row.vehicle_nickname ?? "Car", make: row.vehicle_make ?? "", model: row.vehicle_model ?? "", year: row.vehicle_year ?? 0 } : null,
    likesCount: Number(row.likes_count), commentsCount: Number(row.comments_count), likedByViewer: row.liked_by_viewer,
  }));
}

export async function getPost(id: string): Promise<Post | null> {
  const post = (await getFeed()).find((item) => item.id === id);
  if (!post || !isSupabaseConfigured()) return post ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("comments").select("id,body,created_at,profiles!comments_author_id_fkey(username,display_name,avatar_path,provider_avatar_url)").eq("post_id", id).order("created_at", { ascending: true });
  const comments: Comment[] = (data ?? []).map((row) => {
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { id: row.id, body: row.body, createdAt: row.created_at, author: { username: author?.username ?? "driver", displayName: author?.display_name ?? "iRide driver", avatarUrl: resolveAvatarUrl(publicMediaUrl(supabase, "avatars", author?.avatar_path), author?.provider_avatar_url) } };
  });
  return { ...post, comments };
}

export async function getMemberProfile(username: string, viewerId: string): Promise<MemberProfile | null> {
  if (!isSupabaseConfigured()) return username === demoProfile.username ? { profile: demoProfile, vehicles: demoVehicles, isOwner: false, isFollowing: false } : null;
  const supabase = await createClient();
  const { data: row } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  if (!row) return null;
  const [{ data: vehicleRows }, { data: stats }, { data: follow }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("owner_id", row.id).order("created_at"),
    supabase.rpc("profile_stats", { target: row.id }).maybeSingle(),
    viewerId === row.id ? Promise.resolve({ data: null }) : supabase.from("follows").select("following_id").eq("follower_id", viewerId).eq("following_id", row.id).maybeSingle(),
  ]);
  const profile: Profile = { id: row.id, username: row.username, displayName: row.display_name, bio: row.bio, location: row.location, avatarUrl: resolveAvatarUrl(publicMediaUrl(supabase, "avatars", row.avatar_path), row.provider_avatar_url), locale: row.locale as Profile["locale"], followersCount: stats?.followers_count ?? 0, followingCount: stats?.following_count ?? 0 };
  return { profile, vehicles: (vehicleRows ?? []).map(mapVehicle.bind(null, supabase)), isOwner: viewerId === row.id, isFollowing: Boolean(follow) };
}

export async function getMyProfile(): Promise<Profile | null> {
  const viewer = await getViewerContext();
  if (!viewer?.username) return null;
  return (await getMemberProfile(viewer.username, viewer.id))?.profile ?? null;
}

export async function getMyVehicles(): Promise<Vehicle[]> {
  const viewer = await getViewer();
  if (!viewer) return isSupabaseConfigured() ? [] : demoVehicles;
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*").eq("owner_id", viewer.id).order("created_at");
  return (data ?? []).map(mapVehicle.bind(null, supabase));
}

function publicMediaUrl(supabase: Awaited<ReturnType<typeof createClient>>, bucket: "avatars" | "vehicle-media", path: string | null | undefined) {
  return path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
}

function mapVehicle(supabase: Awaited<ReturnType<typeof createClient>>, row: { id: string; owner_id: string; nickname: string; make: string; model: string; year: number; trim: string | null; color: string | null; description: string | null; cover_path: string | null }): Vehicle {
  return { id: row.id, ownerId: row.owner_id, nickname: row.nickname, make: row.make, model: row.model, year: row.year, trim: row.trim, color: row.color, description: row.description, coverUrl: publicMediaUrl(supabase, "vehicle-media", row.cover_path) };
}
