import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type { Json, Tables, TablesInsert } from "@iride/database/types";
import type {
  CreateEventInput,
  CreatePostInput,
  EventDto,
  PostDto,
  SearchResultDto,
  UpdateEventInput,
} from "@iride/types";

import type {
  ContentRepository,
  SearchType,
} from "./content";

interface ContentRepositoryConfig {
  readonly url: string;
  readonly publishableKey: string;
  readonly serviceRoleKey: string;
}

type AdminClient = ReturnType<typeof createAdminDatabaseClient>;
type ViewerCapabilities = {
  readonly userId: string | null;
  readonly canWrite: boolean;
  readonly canManage: boolean;
};

export function createContentRepository(
  config: ContentRepositoryConfig,
): ContentRepository {
  const admin = createAdminDatabaseClient(config);
  const ownerClient = (accessToken: string) =>
    createServerDatabaseClient({
      url: config.url,
      publishableKey: config.publishableKey,
      accessToken,
    });

  return {
    async listPosts(viewerId, category) {
      const viewer = await viewerCapabilities(admin, viewerId);
      let query = admin
        .from("posts")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (category) query = query.eq("community_category", category);
      const { data, error } = await query.limit(50);
      ensureQuery(error);
      return postDtos(admin, data ?? [], viewer);
    },
    async getPost(id, viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const row = await findPost(admin, id);
      if (!row || (row.deleted_at && row.author_id !== viewer.userId && !viewer.canManage)) return null;
      return (await postDtos(admin, [row], viewer))[0] ?? null;
    },
    async createPost(userId, accessToken, input) {
      await validateMarkerTags(admin, input.markerTags ?? []);
      const { data:id, error } = await ownerClient(accessToken).rpc("save_post_with_markers", {
        target_post_id:null as unknown as string, post_body:input.body, marker_tags:(input.markerTags ?? []) as unknown as Json, post_community_category:input.communityCategory,
      });
      ensureWrite(error, id);
      const data=await findPost(admin,id!);ensureWrite(null,data);
      return (await postDtos(admin, [data!], await viewerCapabilities(admin, userId)))[0]!;
    },
    async updatePost(userId, accessToken, id, input) {
      const viewer = await viewerCapabilities(admin, userId);
      await assertOwner(await findPost(admin, id), "author_id", viewer);
      await validateMarkerTags(admin, input.markerTags ?? []);
      const { data:savedId, error } = await ownerClient(accessToken).rpc("save_post_with_markers", {
        target_post_id:id, post_body:input.body, marker_tags:(input.markerTags ?? []) as unknown as Json, post_community_category:input.communityCategory,
      });
      ensureWrite(error, savedId);
      const data=await findPost(admin,savedId!);ensureWrite(null,data);
      return (await postDtos(admin, [data!], viewer))[0]!;
    },
    async deletePost(userId, accessToken, id) {
      await assertOwner(await findPost(admin, id), "author_id", await viewerCapabilities(admin, userId));
      const { data, error } = await ownerClient(accessToken)
        .from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      ensureWrite(error, data);
    },
    async listEvents(viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const { data, error } = await admin
        .from("events")
        .select("*")
        .is("deleted_at", null)
        .order("starts_at")
        .limit(100);
      ensureQuery(error);
      return eventDtos(admin, data ?? [], viewer);
    },
    async getEvent(id, viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const row = await findEvent(admin, id);
      if (!row || (row.deleted_at && row.organizer_id !== viewer.userId && !viewer.canManage)) return null;
      return (await eventDtos(admin, [row], viewer))[0] ?? null;
    },
    async createEvent(userId, accessToken, input) {
      const insert = eventWrite(input, { organizer_id: userId });
      const { data, error } = await ownerClient(accessToken)
        .from("events")
        .insert(insert)
        .select("*")
        .single();
      ensureWrite(error, data);
      return (await eventDtos(admin, [data!], await viewerCapabilities(admin, userId)))[0]!;
    },
    async updateEvent(userId, accessToken, id, input) {
      const viewer = await viewerCapabilities(admin, userId);
      const current = await findEvent(admin, id);
      await assertOwner(current, "organizer_id", viewer);
      const merged = mergeEvent(current!, input);
      const { data, error } = await ownerClient(accessToken)
        .from("events")
        .update(eventWrite(merged, {}))
        .eq("id", id)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle();
      ensureWrite(error, data);
      return (await eventDtos(admin, [data!], viewer))[0]!;
    },
    async deleteEvent(userId, accessToken, id) {
      await assertOwner(await findEvent(admin, id), "organizer_id", await viewerCapabilities(admin, userId));
      const { data, error } = await ownerClient(accessToken)
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      ensureWrite(error, data);
    },
    async explore(bounds, layers, viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const { data, error } = await admin.rpc("explore_content", {
        ...bounds,
        layers,
      });
      ensureQuery(error);
      const people = await authors(admin, (data ?? []).map((row) => row.author_id), viewer.canManage);
      return (data ?? []).flatMap((row) => {
        const author = people.get(row.author_id);
        return author ? [{
        id: row.id,
        kind: normalizeExploreKind(row.kind),
        title: row.title,
        subtitle: row.subtitle,
        latitude: row.latitude,
        longitude: row.longitude,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        author,
        canEdit: viewer.canManage || (viewer.canWrite && row.author_id === viewer.userId),
      }] : [];
      });
    },
    async search(query, types, viewerId) {
      return searchContent(admin, query, types, await viewerCapabilities(admin, viewerId));
    },
  };
}

async function findPost(admin: AdminClient, id: string) {
  const { data, error } = await admin.from("posts").select("*").eq("id", id).maybeSingle();
  ensureQuery(error);
  return data;
}

async function findEvent(admin: AdminClient, id: string) {
  const { data, error } = await admin.from("events").select("*").eq("id", id).maybeSingle();
  ensureQuery(error);
  return data;
}


async function authors(admin: AdminClient, ids: readonly string[], includeSuspended = false) {
  const unique = Array.from(new Set(ids));
  if (!unique.length) return new Map();
  const [{ data, error }, { data: access, error: accessError }] = await Promise.all([
    admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", unique),
    admin.from("account_access").select("user_id,status,transition_id").in("user_id", unique),
  ]);
  ensureQuery(error);
  ensureQuery(accessError);
  const statusByUserId = new Map((access ?? []).map((row) => [row.user_id, row]));
  return new Map(
    (data ?? [])
      .filter((row) => {
        const access = statusByUserId.get(row.id);
        return Boolean(row.username && row.display_name && access?.transition_id === null && (includeSuspended || access.status !== "suspended"));
      })
      .map((row) => [
        row.id,
        { id: row.id, username: row.username!, displayName: row.display_name! },
      ] as const),
  );
}

async function postDtos(admin: AdminClient, rows: Tables<"posts">[], viewer: ViewerCapabilities): Promise<PostDto[]> {
  const people = await authors(admin, rows.map((row) => row.author_id), viewer.canManage);
  const postIds = rows.map((row) => row.id);
  const tags = await postMarkerTags(admin, postIds, viewer);
  const counts = new Map<string, number>();
  if (postIds.length) {
    const { data, error } = await admin.from("comments").select("post_id,author_id").in("post_id", postIds);
    ensureQuery(error);
    const authorIds = [...new Set((data ?? []).map((item) => item.author_id))];
    const { data: access, error: accessError } = authorIds.length
      ? await admin.from("account_access").select("user_id,status,transition_id").in("user_id", authorIds)
      : { data: [], error: null };
    ensureQuery(accessError);
    const statuses = new Map((access ?? []).map((item) => [item.user_id, item]));
    for (const item of data ?? []) {
      const access = statuses.get(item.author_id);
      if (access?.transition_id === null && (viewer.canManage || access.status !== "suspended")) {
        counts.set(item.post_id, (counts.get(item.post_id) ?? 0) + 1);
      }
    }
  }
  return rows.flatMap((row) => {
    const author = people.get(row.author_id);
    return author ? [{ id: row.id, body: row.body, communityCategory: row.community_category, author, canEdit: viewer.canManage || (viewer.canWrite && row.author_id === viewer.userId), commentCount: counts.get(row.id) ?? 0, markerTags: tags.get(row.id) ?? [], createdAt: row.created_at, updatedAt: row.updated_at }] : [];
  });
}

async function postMarkerTags(
  admin: AdminClient,
  postIds: readonly string[],
  viewer: ViewerCapabilities,
) {
  const result = new Map<string, PostDto["markerTags"]>();
  if (!postIds.length) return result;
  const { data, error } = await admin.from("post_marker_tags").select("*").in("post_id", [...postIds]).order("position");
  ensureQuery(error);
  const eventIds=(data??[]).flatMap((row)=>row.event_id?[row.event_id]:[]);
  const { data: events, error: eventsError } = eventIds.length
    ? await admin.from("events").select("id,title,kind,deleted_at,organizer_id").in("id",eventIds)
    : { data: [], error: null };
  ensureQuery(eventsError);
  const eventMap=new Map((events??[]).map((row)=>[row.id,row]));
  const people = await authors(admin, (events ?? []).map((row) => row.organizer_id), viewer.canManage);
  for(const row of data??[]){
    const target=row.event_id ? eventMap.get(row.event_id) : undefined;
    const targetVisible = Boolean(
      target &&
      !target.deleted_at &&
      people.has(target.organizer_id),
    );
    const value = {kind:"event" as const,id:row.event_id!,title:targetVisible?target!.title:null,markerKind:targetVisible ? normalizeExploreKind(String(target!.kind)) : null,available:targetVisible};
    result.set(row.post_id,[...(result.get(row.post_id)??[]),value]);
  }
  return result;
}

async function validateMarkerTags(admin:AdminClient,tags:NonNullable<CreatePostInput["markerTags"]>){
  const eventIds=tags.filter((tag)=>tag.kind==="event").map((tag)=>tag.id);
  const events = eventIds.length
    ? await admin.from("events").select("id").in("id",eventIds).is("deleted_at",null)
    : { data: [], error: null };
  ensureQuery(events.error);
  if((events.data??[]).length!==eventIds.length)throw repositoryError("CONTENT_VALIDATION_FAILED",400);
}

async function eventDtos(admin: AdminClient, rows: Tables<"events">[], viewer: ViewerCapabilities): Promise<EventDto[]> {
  const people = await authors(admin, rows.map((row) => row.organizer_id), viewer.canManage);
  return rows.flatMap((row) => {
    const organizer = people.get(row.organizer_id);
    return organizer ? [{
      id: row.id, kind: row.kind, title: row.title, description: row.description,
      locationLabel: row.location_label, latitude: row.latitude, longitude: row.longitude,
      destinationLabel: row.destination_label, destinationLatitude: row.destination_latitude,
      destinationLongitude: row.destination_longitude, startsAt: row.starts_at, endsAt: row.ends_at,
      timezone: row.timezone, vehicleKinds: row.vehicle_kinds, organizer,
      canEdit: viewer.canManage || (viewer.canWrite && row.organizer_id === viewer.userId), createdAt: row.created_at, updatedAt: row.updated_at,
    }] : [];
  });
}


function eventWrite(
  input: CreateEventInput,
  extra: Partial<TablesInsert<"events">>,
): TablesInsert<"events"> {
  return {
    ...extra,
    kind: input.kind,
    title: input.title,
    description: input.description,
    location_label: input.locationLabel,
    latitude: input.latitude,
    longitude: input.longitude,
    destination_label: input.destinationLabel ?? null,
    destination_latitude: input.destinationLatitude ?? null,
    destination_longitude: input.destinationLongitude ?? null,
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    timezone: input.timezone,
    vehicle_kinds: [...input.vehicleKinds],
    organizer_id: extra.organizer_id!,
  };
}

function mergeEvent(row: Tables<"events">, input: UpdateEventInput): CreateEventInput {
  return {
    kind: input.kind ?? row.kind,
    title: input.title ?? row.title,
    description: input.description === undefined ? row.description : input.description,
    locationLabel: input.locationLabel ?? row.location_label,
    latitude: input.latitude ?? row.latitude,
    longitude: input.longitude ?? row.longitude,
    destinationLabel: input.destinationLabel === undefined ? row.destination_label : input.destinationLabel,
    destinationLatitude: input.destinationLatitude === undefined ? row.destination_latitude : input.destinationLatitude,
    destinationLongitude: input.destinationLongitude === undefined ? row.destination_longitude : input.destinationLongitude,
    startsAt: input.startsAt ?? row.starts_at,
    endsAt: input.endsAt === undefined ? row.ends_at : input.endsAt,
    timezone: input.timezone ?? row.timezone,
    vehicleKinds: input.vehicleKinds ?? row.vehicle_kinds,
  };
}


async function assertOwner<Row extends Record<Key, string>, Key extends string>(
  row: Row | null,
  key: Key,
  viewer: ViewerCapabilities,
): Promise<void> {
  if (!row || (!viewer.canManage && (!viewer.canWrite || row[key] !== viewer.userId)) || ("deleted_at" in row && row.deleted_at)) {
    throw repositoryError(row ? "CONTENT_FORBIDDEN" : "CONTENT_NOT_FOUND", row ? 403 : 404);
  }
}

function ensureQuery(error: { message?: string } | null): void {
  if (error) throw repositoryError("CONTENT_UNAVAILABLE", 503, error);
}

function ensureWrite(error: { code?: string; message?: string } | null, data: unknown): void {
  if (error) {
    const forbidden = error.code === "42501";
    throw repositoryError(forbidden ? "CONTENT_FORBIDDEN" : "CONTENT_UPDATE_FAILED", forbidden ? 403 : 503, error);
  }
  if (!data) throw repositoryError("CONTENT_NOT_FOUND", 404);
}

function repositoryError(code: string, status: number, cause?: unknown) {
  return Object.assign(new Error(code, cause ? { cause } : undefined), { code, status });
}

function normalizeExploreKind(value: string): "meeting" | "event" | "trip" {
  if (value === "meeting" || value === "event" || value === "trip") return value;
  throw new Error("CONTENT_UNAVAILABLE");
}

async function searchContent(
  admin: AdminClient,
  query: string,
  types: SearchType[],
  viewer: ViewerCapabilities,
): Promise<SearchResultDto[]> {
  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const results: SearchResultDto[] = [];
  if (types.includes("profiles")) {
    const [byUsername, byName] = await Promise.all([
      admin.from("profiles").select("id,username,display_name,bio").in("visibility", ["public", "followers"]).ilike("username", pattern).limit(8),
      admin.from("profiles").select("id,username,display_name,bio").in("visibility", ["public", "followers"]).ilike("display_name", pattern).limit(8),
    ]);
    ensureQuery(byUsername.error); ensureQuery(byName.error);
    const profiles = new Map([...(byUsername.data ?? []), ...(byName.data ?? [])].map((row) => [row.id, row]));
    const people = await authors(admin, [...profiles.keys()], viewer.canManage);
    for (const row of profiles.values()) if (row.username && row.display_name && people.has(row.id)) results.push({ id: row.id, kind: "profile", title: row.display_name, subtitle: `@${row.username}`, username: row.username });
  }
  if (types.includes("posts")) {
    const { data, error } = await admin.from("posts").select("id,body,author_id,community_category").is("deleted_at", null).ilike("body", pattern).limit(8);
    ensureQuery(error);
    const people = await authors(admin, (data ?? []).map((row) => row.author_id), viewer.canManage);
    for (const row of data ?? []) { const author = people.get(row.author_id); if (author) results.push({ id: row.id, kind: "post", title: row.body.slice(0, 80), subtitle: author.displayName, username: author.username, communityCategory: row.community_category }); }
  }
  if (types.includes("events")) {
    const { data, error } = await admin.from("events").select("id,title,location_label,organizer_id").is("deleted_at", null).ilike("title", pattern).limit(8);
    ensureQuery(error);
    const people = await authors(admin, (data ?? []).map((row) => row.organizer_id), viewer.canManage);
    for (const row of data ?? []) if (people.has(row.organizer_id)) results.push({ id: row.id, kind: "event", title: row.title, subtitle: row.location_label, username: null });
  }
  return results.slice(0, 30);
}

async function viewerCapabilities(admin: AdminClient, userId: string | null): Promise<ViewerCapabilities> {
  if (!userId) return { userId: null, canWrite: false, canManage: false };
  const { data, error } = await admin.from("account_access").select("role,status,transition_id").eq("user_id", userId).maybeSingle();
  ensureQuery(error);
  const active = data?.status === "active" && data.transition_id === null;
  return { userId, canWrite: active, canManage: active && data?.role === "admin" };
}
