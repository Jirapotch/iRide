import "server-only";

import { cache } from "react";
import { demoPosts, demoProfile, demoVehicles } from "@/lib/demo-data";
import { getTransitionalMediaStorage } from "@/lib/media-storage-runtime";
import { resolveAvatarUrl } from "@/lib/profile-utils";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Comment, FollowRequest, FollowStatus, MemberProfile, Post, Profile, Vehicle, ViewerContext } from "@/lib/types";

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
  const [{ data: stats }, { count: vehicleCount }, avatarUrls] = await Promise.all([
    supabase.rpc("profile_stats", { target: user.id }).maybeSingle(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    mediaUrls(supabase, "avatars", [row.avatar_path]),
  ]);
  return { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: resolveAvatarUrl(mediaUrl(avatarUrls, row.avatar_path), row.provider_avatar_url), onboardingCompleted: row.onboarding_completed, followersCount: stats?.followers_count ?? 0, vehicleCount: vehicleCount ?? 0 };
});

export async function getFeed(): Promise<Post[]> {
  if (!isSupabaseConfigured()) return demoPosts;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feed_posts", { feed_limit: 20 });
  if (error || !data) return [];
  const [signedByPath, avatarUrls] = await Promise.all([
    mediaUrls(supabase, "post-media", data.map((row) => row.photo_path)),
    mediaUrls(supabase, "avatars", data.map((row) => row.author_avatar_path)),
  ]);
  return data.map((row) => ({
    id: row.id, body: row.body, photoUrl: row.photo_path ? signedByPath.get(row.photo_path) ?? null : null, createdAt: row.created_at,
    author: { username: row.author_username, displayName: row.author_display_name, avatarUrl: resolveAvatarUrl(mediaUrl(avatarUrls, row.author_avatar_path), row.author_provider_avatar_url) },
    vehicle: row.vehicle_id ? { id: row.vehicle_id, name: row.vehicle_nickname ?? "Vehicle", brand: row.vehicle_make, model: row.vehicle_model, year: row.vehicle_year } : null,
    likesCount: Number(row.likes_count), commentsCount: Number(row.comments_count), likedByViewer: row.liked_by_viewer,
  }));
}

export async function getPost(id: string): Promise<Post | null> {
  if (!isSupabaseConfigured()) return demoPosts.find((item) => item.id === id) ?? null;
  const supabase = await createClient();
  const viewer = await getViewer();
  const [{ data: row }, { data: commentRows }, { data: viewerLike }] = await Promise.all([
    supabase.from("posts").select("id,body,photo_path,created_at,profiles!posts_author_id_fkey(username,display_name,avatar_path,provider_avatar_url),vehicles!posts_vehicle_id_fkey(id,nickname,make,model,year),likes(count),comments(count)").eq("id", id).maybeSingle(),
    supabase.from("comments").select("id,body,created_at,profiles!comments_author_id_fkey(username,display_name,avatar_path,provider_avatar_url)").eq("post_id", id).order("created_at", { ascending: true }),
    viewer ? supabase.from("likes").select("post_id").eq("post_id", id).eq("user_id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!row) return null;
  const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
  const [signed, avatarUrls] = await Promise.all([
    mediaUrls(supabase, "post-media", [row.photo_path]),
    mediaUrls(supabase, "avatars", [author?.avatar_path, ...(commentRows ?? []).map((comment) => {
      const commentAuthor = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
      return commentAuthor?.avatar_path;
    })]),
  ]);
  const comments: Comment[] = (commentRows ?? []).map((comment) => {
    const author = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    return { id: comment.id, body: comment.body, createdAt: comment.created_at, author: { username: author?.username ?? "driver", displayName: author?.display_name ?? "iRide driver", avatarUrl: resolveAvatarUrl(mediaUrl(avatarUrls, author?.avatar_path), author?.provider_avatar_url) } };
  });
  return {
    id: row.id, body: row.body, photoUrl: row.photo_path ? signed.get(row.photo_path) ?? null : null, createdAt: row.created_at,
    author: { username: author?.username ?? "driver", displayName: author?.display_name ?? "iRide driver", avatarUrl: resolveAvatarUrl(mediaUrl(avatarUrls, author?.avatar_path), author?.provider_avatar_url) },
    vehicle: vehicle ? { id: vehicle.id, name: vehicle.nickname, brand: vehicle.make, model: vehicle.model, year: vehicle.year } : null,
    likesCount: Number(row.likes[0]?.count ?? 0), commentsCount: Number(row.comments[0]?.count ?? 0), likedByViewer: Boolean(viewerLike), comments,
  };
}

export async function getMemberProfile(username: string, viewerId: string): Promise<MemberProfile | null> {
  if (!isSupabaseConfigured()) return username === demoProfile.username ? { profile: demoProfile, vehicles: demoVehicles, posts: demoPosts.filter((post) => post.author.username === username), isOwner: false, canViewContent: true, followStatus: "none" } : null;
  const supabase = await createClient();
  const { data: row } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  if (!row) return null;
  const [{ data: vehicleRows }, { data: postRows }, { data: stats }, { data: follow }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("owner_id", row.id).order("created_at"),
    supabase.from("posts").select("id,body,photo_path,created_at,vehicles!posts_vehicle_id_fkey(id,nickname,make,model,year),likes(count),comments(count)").eq("author_id", row.id).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("profile_stats", { target: row.id }).maybeSingle(),
    viewerId === row.id ? Promise.resolve({ data: null }) : supabase.from("follows").select("status").eq("follower_id", viewerId).eq("following_id", row.id).maybeSingle(),
  ]);
  const isOwner = viewerId === row.id;
  const followStatus = (follow?.status as FollowStatus | undefined) ?? "none";
  const canViewContent = isOwner || !row.is_private || followStatus === "accepted";
  const [avatarUrls, vehicleUrls, signedByPath] = await Promise.all([
    mediaUrls(supabase, "avatars", [row.avatar_path, row.cover_path]),
    mediaUrls(supabase, "vehicle-media", (vehicleRows ?? []).map((vehicle) => vehicle.cover_path)),
    mediaUrls(supabase, "post-media", (postRows ?? []).map((post) => post.photo_path)),
  ]);
  const profile: Profile = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    location: row.location,
    avatarUrl: resolveAvatarUrl(mediaUrl(avatarUrls, row.avatar_path), row.provider_avatar_url),
    coverUrl: mediaUrl(avatarUrls, row.cover_path),
    locale: row.locale as Profile["locale"],
    isPrivate: row.is_private,
    followersCount: stats?.followers_count ?? 0,
    followingCount: stats?.following_count ?? 0,
  };
  const posts: Post[] = (postRows ?? []).map((post) => {
    const vehicle = Array.isArray(post.vehicles) ? post.vehicles[0] : post.vehicles;
    return {
      id: post.id,
      body: post.body,
      photoUrl: post.photo_path ? signedByPath.get(post.photo_path) ?? null : null,
      createdAt: post.created_at,
      author: { username: profile.username, displayName: profile.displayName, avatarUrl: profile.avatarUrl },
      vehicle: vehicle ? { id: vehicle.id, name: vehicle.nickname, brand: vehicle.make, model: vehicle.model, year: vehicle.year } : null,
      likesCount: Number(post.likes[0]?.count ?? 0),
      commentsCount: Number(post.comments[0]?.count ?? 0),
      likedByViewer: false,
    };
  });
  if (posts.length) {
    const { data: viewerLikes } = await supabase.from("likes").select("post_id").eq("user_id", viewerId).in("post_id", posts.map((post) => post.id));
    const likedIds = new Set((viewerLikes ?? []).map((like) => like.post_id));
    posts.forEach((post) => { post.likedByViewer = likedIds.has(post.id); });
  }
  return { profile, vehicles: (vehicleRows ?? []).map((vehicle) => mapVehicle(vehicle, vehicleUrls)), posts, isOwner, canViewContent, followStatus };
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
  const urls = await mediaUrls(supabase, "vehicle-media", (data ?? []).map((vehicle) => vehicle.cover_path));
  return (data ?? []).map((vehicle) => mapVehicle(vehicle, urls));
}

export async function getOwnedPost(id: string): Promise<Post | null> {
  const viewer = await getViewer();
  if (!viewer || !isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: row } = await supabase.from("posts").select("id,body,photo_path,created_at,profiles!posts_author_id_fkey(username,display_name,avatar_path,provider_avatar_url),vehicles!posts_vehicle_id_fkey(id,nickname,make,model,year),likes(count),comments(count)").eq("id", id).eq("author_id", viewer.id).maybeSingle();
  if (!row) return null;
  const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
  const [signed, avatarUrls] = await Promise.all([
    mediaUrls(supabase, "post-media", [row.photo_path]),
    mediaUrls(supabase, "avatars", [author?.avatar_path]),
  ]);
  return {
    id: row.id,
    body: row.body,
    photoUrl: row.photo_path ? signed.get(row.photo_path) ?? null : null,
    createdAt: row.created_at,
    author: { username: author?.username ?? "driver", displayName: author?.display_name ?? "iRide driver", avatarUrl: resolveAvatarUrl(mediaUrl(avatarUrls, author?.avatar_path), author?.provider_avatar_url) },
    vehicle: vehicle ? { id: vehicle.id, name: vehicle.nickname, brand: vehicle.make, model: vehicle.model, year: vehicle.year } : null,
    likesCount: Number(row.likes[0]?.count ?? 0),
    commentsCount: Number(row.comments[0]?.count ?? 0),
    likedByViewer: false,
  };
}

export async function getOwnedVehicle(id: string): Promise<Vehicle | null> {
  const viewer = await getViewer();
  if (!viewer || !isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*").eq("id", id).eq("owner_id", viewer.id).maybeSingle();
  if (!data) return null;
  const urls = await mediaUrls(supabase, "vehicle-media", [data.cover_path]);
  return mapVehicle(data, urls);
}

export async function getPendingFollowRequests(): Promise<FollowRequest[]> {
  const viewer = await getViewer();
  if (!viewer || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("follower_id,created_at,profiles!follows_follower_id_fkey(username,display_name,avatar_path,provider_avatar_url)").eq("following_id", viewer.id).eq("status", "pending").order("created_at");
  const avatarUrls = await mediaUrls(supabase, "avatars", (data ?? []).map((request) => {
    const follower = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
    return follower?.avatar_path;
  }));
  return (data ?? []).map((request) => {
    const follower = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
    return {
      followerId: request.follower_id,
      username: follower?.username ?? "driver",
      displayName: follower?.display_name ?? "iRide member",
      avatarUrl: resolveAvatarUrl(mediaUrl(avatarUrls, follower?.avatar_path), follower?.provider_avatar_url),
      createdAt: request.created_at,
    };
  });
}

async function mediaUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: "avatars" | "vehicle-media" | "post-media",
  paths: Array<string | null | undefined>,
) {
  return getTransitionalMediaStorage(supabase).urls(bucket, paths.filter((path): path is string => Boolean(path)));
}

function mediaUrl(urls: Map<string, string>, path: string | null | undefined) {
  return path ? urls.get(path) ?? null : null;
}

function mapVehicle(row: { id: string; owner_id: string; nickname: string; make: string | null; model: string | null; year: number | null; trim: string | null; color: string | null; description: string | null; cover_path: string | null }, urls: Map<string, string>): Vehicle {
  return { id: row.id, ownerId: row.owner_id, name: row.nickname, brand: row.make, model: row.model, year: row.year, trim: row.trim, color: row.color, description: row.description, coverUrl: mediaUrl(urls, row.cover_path) };
}
