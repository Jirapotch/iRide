import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type { Tables, TablesInsert } from "@iride/database/types";
import type {
  CreateEventInput,
  CreatePhotographerSpotInput,
  CreatePostInput,
  EventDto,
  PhotographerSpotDto,
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
    async listPosts(viewerId) {
      const { data, error } = await admin
        .from("posts")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      ensureQuery(error);
      return postDtos(admin, data ?? [], viewerId);
    },
    async getPost(id, viewerId) {
      const row = await findPost(admin, id);
      if (!row || (row.deleted_at && row.author_id !== viewerId)) return null;
      return (await postDtos(admin, [row], viewerId))[0] ?? null;
    },
    async createPost(userId, accessToken, input) {
      await validateMarkerTags(admin, input.markerTags ?? []);
      const { data, error } = await ownerClient(accessToken)
        .from("posts")
        .insert({ author_id: userId, body: input.body })
        .select("*")
        .single();
      ensureWrite(error, data);
      await replacePostMarkerTags(ownerClient(accessToken), data!.id, input.markerTags ?? []);
      return (await postDtos(admin, [data!], userId))[0]!;
    },
    async updatePost(userId, accessToken, id, input) {
      await assertOwner(await findPost(admin, id), "author_id", userId);
      await validateMarkerTags(admin, input.markerTags ?? []);
      const { data, error } = await ownerClient(accessToken)
        .from("posts")
        .update({ body: input.body })
        .eq("id", id)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle();
      ensureWrite(error, data);
      await replacePostMarkerTags(ownerClient(accessToken), id, input.markerTags ?? []);
      return (await postDtos(admin, [data!], userId))[0]!;
    },
    async deletePost(userId, accessToken, id) {
      await assertOwner(await findPost(admin, id), "author_id", userId);
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
      const { data, error } = await admin
        .from("events")
        .select("*")
        .is("deleted_at", null)
        .order("starts_at")
        .limit(100);
      ensureQuery(error);
      return eventDtos(admin, data ?? [], viewerId);
    },
    async getEvent(id, viewerId) {
      const row = await findEvent(admin, id);
      if (!row || (row.deleted_at && row.organizer_id !== viewerId)) return null;
      return (await eventDtos(admin, [row], viewerId))[0] ?? null;
    },
    async createEvent(userId, accessToken, input) {
      const insert = eventWrite(input, { organizer_id: userId });
      const { data, error } = await ownerClient(accessToken)
        .from("events")
        .insert(insert)
        .select("*")
        .single();
      ensureWrite(error, data);
      return (await eventDtos(admin, [data!], userId))[0]!;
    },
    async updateEvent(userId, accessToken, id, input) {
      const current = await findEvent(admin, id);
      await assertOwner(current, "organizer_id", userId);
      const merged = mergeEvent(current!, input);
      const { data, error } = await ownerClient(accessToken)
        .from("events")
        .update(eventWrite(merged, {}))
        .eq("id", id)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle();
      ensureWrite(error, data);
      return (await eventDtos(admin, [data!], userId))[0]!;
    },
    async deleteEvent(userId, accessToken, id) {
      await assertOwner(await findEvent(admin, id), "organizer_id", userId);
      const { data, error } = await ownerClient(accessToken)
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      ensureWrite(error, data);
    },
    async listPhotographerSpots(viewerId) {
      const { data, error } = await admin
        .from("photographer_spots")
        .select("*")
        .is("deleted_at", null)
        .order("starts_at")
        .limit(100);
      ensureQuery(error);
      return spotDtos(admin, data ?? [], viewerId);
    },
    async getPhotographerSpot(id, viewerId) {
      const row = await findSpot(admin, id);
      if (!row || (row.deleted_at && row.owner_id !== viewerId)) return null;
      return (await spotDtos(admin, [row], viewerId))[0] ?? null;
    },
    async createPhotographerSpot(userId, accessToken, input) {
      const { data, error } = await ownerClient(accessToken)
        .from("photographer_spots")
        .insert(spotWrite(input, { owner_id: userId }))
        .select("*")
        .single();
      ensureWrite(error, data);
      return (await spotDtos(admin, [data!], userId))[0]!;
    },
    async updatePhotographerSpot(userId, accessToken, id, input) {
      const current = await findSpot(admin, id);
      await assertOwner(current, "owner_id", userId);
      const { data, error } = await ownerClient(accessToken)
        .from("photographer_spots")
        .update(spotWrite({ ...spotInput(current!), ...input }, {}))
        .eq("id", id)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle();
      ensureWrite(error, data);
      return (await spotDtos(admin, [data!], userId))[0]!;
    },
    async deletePhotographerSpot(userId, accessToken, id) {
      await assertOwner(await findSpot(admin, id), "owner_id", userId);
      const { data, error } = await ownerClient(accessToken)
        .from("photographer_spots")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      ensureWrite(error, data);
    },
    async explore(bounds, layers, viewerId) {
      const { data, error } = await admin.rpc("explore_content", {
        ...bounds,
        layers,
      });
      ensureQuery(error);
      return (data ?? []).map((row) => ({
        id: row.id,
        kind: normalizeExploreKind(row.kind),
        title: row.title,
        subtitle: row.subtitle,
        latitude: row.latitude,
        longitude: row.longitude,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        author: {
          id: row.author_id,
          username: row.author_username,
          displayName: row.author_display_name,
        },
        canEdit: row.author_id === viewerId,
      }));
    },
    async search(query, types, viewerId) {
      return searchContent(admin, query, types, viewerId);
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

async function findSpot(admin: AdminClient, id: string) {
  const { data, error } = await admin.from("photographer_spots").select("*").eq("id", id).maybeSingle();
  ensureQuery(error);
  return data;
}

async function authors(admin: AdminClient, ids: readonly string[]) {
  const unique = Array.from(new Set(ids));
  const { data, error } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", unique);
  ensureQuery(error);
  return new Map(
    (data ?? [])
      .filter((row) => row.username && row.display_name)
      .map((row) => [
        row.id,
        { id: row.id, username: row.username!, displayName: row.display_name! },
      ] as const),
  );
}

async function postDtos(admin: AdminClient, rows: Tables<"posts">[], viewerId: string | null): Promise<PostDto[]> {
  const people = await authors(admin, rows.map((row) => row.author_id));
  const postIds = rows.map((row) => row.id);
  const tags = await postMarkerTags(admin, postIds);
  const counts = new Map<string, number>();
  if (postIds.length) {
    const { data, error } = await admin.from("comments").select("post_id").in("post_id", postIds);
    ensureQuery(error);
    for (const item of data ?? []) counts.set(item.post_id, (counts.get(item.post_id) ?? 0) + 1);
  }
  return rows.flatMap((row) => {
    const author = people.get(row.author_id);
    return author ? [{ id: row.id, body: row.body, author, canEdit: row.author_id === viewerId, commentCount: counts.get(row.id) ?? 0, markerTags: tags.get(row.id) ?? [], createdAt: row.created_at, updatedAt: row.updated_at }] : [];
  });
}

async function postMarkerTags(admin: AdminClient, postIds: readonly string[]) {
  const result = new Map<string, PostDto["markerTags"]>();
  if (!postIds.length) return result;
  const { data, error } = await admin.from("post_marker_tags").select("*").in("post_id", [...postIds]).order("position");
  ensureQuery(error);
  const eventIds=(data??[]).flatMap((row)=>row.event_id?[row.event_id]:[]);
  const spotIds=(data??[]).flatMap((row)=>row.photographer_spot_id?[row.photographer_spot_id]:[]);
  const [events,spots]=await Promise.all([
    eventIds.length?admin.from("events").select("id,title,kind,deleted_at").in("id",eventIds):Promise.resolve({data:[],error:null}),
    spotIds.length?admin.from("photographer_spots").select("id,title,deleted_at").in("id",spotIds):Promise.resolve({data:[],error:null}),
  ]);
  ensureQuery(events.error);ensureQuery(spots.error);
  const eventMap=new Map((events.data??[]).map((row)=>[row.id,row]));
  const spotMap=new Map((spots.data??[]).map((row)=>[row.id,row]));
  for(const row of data??[]){
    const target=row.event_id?eventMap.get(row.event_id):row.photographer_spot_id?spotMap.get(row.photographer_spot_id):undefined;
    const value = row.event_id
      ? {kind:"event" as const,id:row.event_id,title:target&&!target.deleted_at?target.title:null,markerKind:target&&!target.deleted_at&&"kind" in target?normalizeExploreKind(String(target.kind)):null,available:Boolean(target&&!target.deleted_at)}
      : {kind:"photographerSpot" as const,id:row.photographer_spot_id!,title:target&&!target.deleted_at?target.title:null,markerKind:target&&!target.deleted_at?"photographerSpot" as const:null,available:Boolean(target&&!target.deleted_at)};
    result.set(row.post_id,[...(result.get(row.post_id)??[]),value]);
  }
  return result;
}

async function validateMarkerTags(admin:AdminClient,tags:NonNullable<CreatePostInput["markerTags"]>){
  const eventIds=tags.filter((tag)=>tag.kind==="event").map((tag)=>tag.id);
  const spotIds=tags.filter((tag)=>tag.kind==="photographerSpot").map((tag)=>tag.id);
  const [events,spots]=await Promise.all([
    eventIds.length?admin.from("events").select("id").in("id",eventIds).is("deleted_at",null):Promise.resolve({data:[],error:null}),
    spotIds.length?admin.from("photographer_spots").select("id").in("id",spotIds).is("deleted_at",null):Promise.resolve({data:[],error:null}),
  ]);
  ensureQuery(events.error);ensureQuery(spots.error);
  if((events.data??[]).length!==eventIds.length||(spots.data??[]).length!==spotIds.length)throw repositoryError("CONTENT_VALIDATION_FAILED",400);
}

async function replacePostMarkerTags(client:ReturnType<typeof createServerDatabaseClient>,postId:string,tags:NonNullable<CreatePostInput["markerTags"]>){
  const removed=await client.from("post_marker_tags").delete().eq("post_id",postId);ensureQuery(removed.error);
  if(tags.length){const inserted=await client.from("post_marker_tags").insert(tags.map((tag,position)=>({post_id:postId,position,event_id:tag.kind==="event"?tag.id:null,photographer_spot_id:tag.kind==="photographerSpot"?tag.id:null})));ensureQuery(inserted.error);}
}

async function eventDtos(admin: AdminClient, rows: Tables<"events">[], viewerId: string | null): Promise<EventDto[]> {
  const people = await authors(admin, rows.map((row) => row.organizer_id));
  return rows.flatMap((row) => {
    const organizer = people.get(row.organizer_id);
    return organizer ? [{
      id: row.id, kind: row.kind, title: row.title, description: row.description,
      locationLabel: row.location_label, latitude: row.latitude, longitude: row.longitude,
      destinationLabel: row.destination_label, destinationLatitude: row.destination_latitude,
      destinationLongitude: row.destination_longitude, startsAt: row.starts_at, endsAt: row.ends_at,
      timezone: row.timezone, vehicleKinds: row.vehicle_kinds, organizer,
      canEdit: row.organizer_id === viewerId, createdAt: row.created_at, updatedAt: row.updated_at,
    }] : [];
  });
}

async function spotDtos(admin: AdminClient, rows: Tables<"photographer_spots">[], viewerId: string | null): Promise<PhotographerSpotDto[]> {
  const people = await authors(admin, rows.map((row) => row.owner_id));
  return rows.flatMap((row) => {
    const photographer = people.get(row.owner_id);
    return photographer ? [{
      id: row.id, title: row.title, description: row.description, locationLabel: row.location_label,
      latitude: row.latitude, longitude: row.longitude, startsAt: row.starts_at, endsAt: row.ends_at,
      timezone: row.timezone, photographer, canEdit: row.owner_id === viewerId,
      createdAt: row.created_at, updatedAt: row.updated_at,
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

function spotWrite(
  input: CreatePhotographerSpotInput,
  extra: Partial<TablesInsert<"photographer_spots">>,
): TablesInsert<"photographer_spots"> {
  return {
    ...extra,
    title: input.title,
    description: input.description,
    location_label: input.locationLabel,
    latitude: input.latitude,
    longitude: input.longitude,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    timezone: input.timezone,
    owner_id: extra.owner_id!,
  };
}

function spotInput(row: Tables<"photographer_spots">): CreatePhotographerSpotInput {
  return {
    title: row.title,
    description: row.description,
    locationLabel: row.location_label,
    latitude: row.latitude,
    longitude: row.longitude,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
  };
}

async function assertOwner<Row extends Record<Key, string>, Key extends string>(
  row: Row | null,
  key: Key,
  userId: string,
): Promise<void> {
  if (!row || row[key] !== userId || ("deleted_at" in row && row.deleted_at)) {
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

function normalizeExploreKind(value: string): "meeting" | "event" | "trip" | "photographerSpot" {
  return value === "meeting" || value === "event" || value === "trip" ? value : "photographerSpot";
}

async function searchContent(
  admin: AdminClient,
  query: string,
  types: SearchType[],
  viewerId: string | null,
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
    for (const row of profiles.values()) if (row.username && row.display_name) results.push({ id: row.id, kind: "profile", title: row.display_name, subtitle: `@${row.username}`, username: row.username });
  }
  if (types.includes("posts")) {
    const { data, error } = await admin.from("posts").select("id,body,author_id").is("deleted_at", null).ilike("body", pattern).limit(8);
    ensureQuery(error);
    const people = await authors(admin, (data ?? []).map((row) => row.author_id));
    for (const row of data ?? []) { const author = people.get(row.author_id); if (author) results.push({ id: row.id, kind: "post", title: row.body.slice(0, 80), subtitle: author.displayName, username: author.username }); }
  }
  if (types.includes("events")) {
    const { data, error } = await admin.from("events").select("id,title,location_label,organizer_id").is("deleted_at", null).ilike("title", pattern).limit(8);
    ensureQuery(error);
    for (const row of data ?? []) results.push({ id: row.id, kind: "event", title: row.title, subtitle: row.location_label, username: null });
  }
  if (types.includes("photographer-spots")) {
    const { data, error } = await admin.from("photographer_spots").select("id,title,location_label,owner_id").is("deleted_at", null).ilike("title", pattern).limit(8);
    ensureQuery(error);
    const people = await authors(admin, (data ?? []).map((row) => row.owner_id));
    for (const row of data ?? []) { const owner = people.get(row.owner_id); if (owner) results.push({ id: row.id, kind: "photographerSpot", title: row.title, subtitle: row.location_label, username: owner.username }); }
  }
  if (types.includes("market-products")) {
    const { data, error } = await admin.from("market_products").select("id,name,category").is("deleted_at", null).ilike("name", pattern).limit(8);
    ensureQuery(error);
    for (const row of data ?? []) results.push({ id: row.id, kind: "marketProduct", title: row.name, subtitle: row.category, username: null });
  }
  void viewerId;
  return results.slice(0, 30);
}
