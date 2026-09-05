"use server";

import {
  createVehicleSchema,
  createEventSchema,
  createPostSchema,
  updatePostSchema,
} from "@iride/validation";
import type {
  CreateEventInput,
  CreatePostInput,
  MarkerTagInput,
  UpdatePostInput,
} from "@iride/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { createContentTypes, postDestination, type CreateContentType } from "@/lib/create-content-domain";
import { resolveGoogleMapsCoordinates } from "@/lib/google-maps-resolver";
import {
  createEvent,
  createPost,
  deleteContent,
  updateEvent,
  updatePost,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "@/lib/content-api";

export async function saveContent(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login?next=/create");
  const type = String(formData.get("type") ?? "post");
  if (!createContentTypes.includes(type as CreateContentType)) throw new Error("CREATE_TYPE_UNAVAILABLE");
  const editId = optional(formData, "editId");

  if (type === "post") {
    const tags = markerTags(formData);
    const raw = {
      body: String(formData.get("body") ?? ""),
      communityCategory: String(formData.get("communityCategory") ?? "groups"),
      ...(tags.length ? { markerTags: tags } : {}),
    };
    const result = editId
      ? await updatePost(
          session.accessToken,
          editId,
          updatePostSchema.parse(raw) as UpdatePostInput,
        )
      : await createPost(
          session.accessToken,
          createPostSchema.parse(raw) as CreatePostInput,
        );
    redirect(postDestination(result.communityCategory, result.id));
  }

  const kind =
    type === "trip" ? "trip" : String(formData.get("kind") ?? "meeting");
  const raw = {
    kind,
    title: String(formData.get("title") ?? ""),
    description: nullable(formData, "description"),
    locationLabel: String(formData.get("locationLabel") ?? ""),
    latitude: Number(formData.get("latitude")),
    longitude: Number(formData.get("longitude")),
    destinationLabel: nullable(formData, "destinationLabel"),
    destinationLatitude: numberOrNull(formData, "destinationLatitude"),
    destinationLongitude: numberOrNull(formData, "destinationLongitude"),
    startsAt: iso(formData, "startsAt"),
    endsAt: optional(formData, "endsAt") ? iso(formData, "endsAt") : null,
    timezone: String(formData.get("timezone") ?? "Asia/Bangkok"),
    vehicleKinds: formData.getAll("vehicleKinds").map(String),
  };
  const input = createEventSchema.parse(raw) as CreateEventInput;
  const result = editId
    ? await updateEvent(session.accessToken, editId, input)
    : await createEvent(session.accessToken, input);
  redirect(`/maps?marker=${result.id}`);
}

export async function saveVehicleAction(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login");
  const id = optional(formData, "editId");
  const username = String(formData.get("username") ?? "");
  const input = createVehicleSchema.parse({
    kind: String(formData.get("kind")),
    brand: String(formData.get("brand") ?? ""),
    model: String(formData.get("model") ?? ""),
    year: optional(formData, "year") ? Number(formData.get("year")) : null,
    nickname: nullable(formData, "nickname"),
    description: nullable(formData, "description"),
    visibility: String(formData.get("visibility") ?? "public"),
    mediaIds: formData.getAll("mediaIds").map(String),
  });
  const result = id
    ? await updateVehicle(session.accessToken, id, input)
    : await createVehicle(session.accessToken, input);
  redirect(
    `/users/${encodeURIComponent(username)}?tab=garage&vehicle=${result.id}`,
  );
}

export async function removeVehicleAction(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const username = String(formData.get("username") ?? "");
  await deleteVehicle(session.accessToken, id);
  redirect(`/users/${encodeURIComponent(username)}?tab=garage`);
}
export async function removeContent(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const domain = String(formData.get("domain") ?? "") as
    "posts" | "events";
  if (!id || !["posts", "events"].includes(domain))
    throw new Error("INVALID_DELETE");
  await deleteContent(session.accessToken, domain, id);
  revalidatePath(domain === "posts" ? "/community" : "/maps");
  if (domain === "posts") {
    const parsed = createPostSchema.shape.communityCategory.safeParse(String(formData.get("communityCategory") ?? "groups"));
    redirect(postDestination(parsed.success ? parsed.data : "groups", id).split("?")[0]!);
  }
  redirect("/maps");
}

export async function resolveGoogleMapsLocation(input: string) {
  const session = await getVerifiedWebSession();
  if (!session) return null;
  return resolveGoogleMapsCoordinates(input);
}

function optional(data: FormData, key: string) {
  const value = String(data.get(key) ?? "").trim();
  return value || null;
}
function nullable(data: FormData, key: string) {
  return optional(data, key);
}
function numberOrNull(data: FormData, key: string) {
  const value = optional(data, key);
  return value === null ? null : Number(value);
}
function iso(data: FormData, key: string) {
  return new Date(String(data.get(key) ?? "")).toISOString();
}
function markerTags(data: FormData): MarkerTagInput[] {
  return data.getAll("markerTags").flatMap((value) => {
    const [kind, id] = String(value).split(":");
    return kind === "event" && id
      ? [{ kind, id }]
      : [];
  });
}
