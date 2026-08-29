"use server";

import {
  createEventSchema,
  createPhotographerSpotSchema,
  createPostSchema,
  updatePostSchema,
} from "@iride/validation";
import type { CreateEventInput } from "@iride/types";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import {
  createEvent,
  createPhotographerSpot,
  createPost,
  deleteContent,
  updateEvent,
  updatePhotographerSpot,
  updatePost,
} from "@/lib/content-api";

export async function saveContent(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login?next=/create");
  const type = String(formData.get("type") ?? "post");
  const editId = optional(formData, "editId");

  if (type === "post") {
    const schema = editId ? updatePostSchema : createPostSchema;
    const input = schema.parse({ body: String(formData.get("body") ?? "") });
    const result = editId ? await updatePost(session.accessToken, editId, input) : await createPost(session.accessToken, input);
    redirect(`/community?room=talk&post=${result.id}`);
  }

  if (type === "photographer-spot") {
    const raw = {
      title: String(formData.get("title") ?? ""),
      description: nullable(formData, "description"),
      locationLabel: String(formData.get("locationLabel") ?? ""),
      latitude: Number(formData.get("latitude")),
      longitude: Number(formData.get("longitude")),
      startsAt: iso(formData, "startsAt"),
      endsAt: iso(formData, "endsAt"),
      timezone: String(formData.get("timezone") ?? "Asia/Bangkok"),
    };
    const input = createPhotographerSpotSchema.parse(raw);
    const result = editId ? await updatePhotographerSpot(session.accessToken, editId, input) : await createPhotographerSpot(session.accessToken, input);
    redirect(`/?marker=${result.id}`);
  }

  const kind = type === "trip" ? "trip" : String(formData.get("kind") ?? "meeting");
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
  const result = editId ? await updateEvent(session.accessToken, editId, input) : await createEvent(session.accessToken, input);
  redirect(`/?marker=${result.id}`);
}

export async function removeContent(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const domain = String(formData.get("domain") ?? "") as "posts" | "events" | "photographer-spots";
  if (!id || !["posts", "events", "photographer-spots"].includes(domain)) throw new Error("INVALID_DELETE");
  await deleteContent(session.accessToken, domain, id);
  redirect(domain === "posts" ? "/community?room=talk" : "/");
}

function optional(data: FormData, key: string) { const value = String(data.get(key) ?? "").trim(); return value || null; }
function nullable(data: FormData, key: string) { return optional(data, key); }
function numberOrNull(data: FormData, key: string) { const value = optional(data, key); return value === null ? null : Number(value); }
function iso(data: FormData, key: string) { return new Date(String(data.get(key) ?? "")).toISOString(); }
