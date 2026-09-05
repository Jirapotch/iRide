import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type { Json, Tables } from "@iride/database/types";
import type {
  CommentDto,
  ContentAuthorDto,
  CreateVehicleInput,
  ExploreFeatureDto,
  VehicleDto,
} from "@iride/types";

import type { SocialRepository } from "./social";

interface Config {
  readonly url: string;
  readonly publishableKey: string;
  readonly serviceRoleKey: string;
}
type Admin = ReturnType<typeof createAdminDatabaseClient>;
type ViewerCapabilities = { readonly userId: string | null; readonly canWrite: boolean; readonly canManage: boolean };

export function createSocialRepository(config: Config): SocialRepository {
  const admin = createAdminDatabaseClient(config);
  const owner = (token: string) =>
    createServerDatabaseClient({
      url: config.url,
      publishableKey: config.publishableKey,
      accessToken: token,
    });
  return {
    async listComments(postId, viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const { data: post, error: postError } = await admin
        .from("posts")
        .select("id,author_id")
        .eq("id", postId)
        .is("deleted_at", null)
        .maybeSingle();
      ensure(postError);
      if (!post || !(await isVisibleAccount(admin, post.author_id, viewer.canManage))) throw failure("CONTENT_NOT_FOUND", 404);
      const { data, error } = await admin
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at");
      ensure(error);
      return commentDtos(admin, data ?? [], viewer);
    },
    async createComment(userId, token, postId, input) {
      let parentId: string | null = null;
      let replyToUserId: string | null = null;
      if (input.parentId) {
        const parent = await findComment(admin, input.parentId);
        if (!parent || parent.post_id !== postId || parent.deleted_at)
          throw failure("CONTENT_NOT_FOUND", 404);
        parentId = parent.parent_id ?? parent.id;
        replyToUserId = parent.author_id;
      }
      const { data, error } = await owner(token)
        .from("comments")
        .insert({
          post_id: postId,
          author_id: userId,
          body: input.body,
          parent_id: parentId,
          reply_to_user_id: replyToUserId,
        })
        .select("*")
        .single();
      ensureWrite(error, data);
      return (await commentDtos(admin, [data!], await viewerCapabilities(admin, userId)))[0]!;
    },
    async updateComment(userId, token, id, input) {
      const viewer = await viewerCapabilities(admin, userId);
      await assertOwner(await findComment(admin, id), "author_id", viewer);
      const { data, error } = await owner(token)
        .from("comments")
        .update({ body: input.body })
        .eq("id", id)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle();
      ensureWrite(error, data);
      return (await commentDtos(admin, [data!], viewer))[0]!;
    },
    async deleteComment(userId, token, id) {
      await assertOwner(await findComment(admin, id), "author_id", await viewerCapabilities(admin, userId));
      const { data, error } = await owner(token)
        .from("comments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      ensureWrite(error, data);
    },
    async listGarage(username, viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id,username,display_name,visibility")
        .eq("username", username)
        .maybeSingle();
      ensure(profileError);
      if (
        !profile ||
        !(await isVisibleAccount(admin, profile.id, viewer.canManage)) ||
        (profile.visibility === "private" && profile.id !== viewer.userId && !viewer.canManage)
      )
        return [];
      const query = admin
        .from("vehicles")
        .select("*")
        .eq("owner_id", profile.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (profile.id !== viewer.userId && !viewer.canManage) query.eq("visibility", "public");
      const { data, error } = await query;
      ensure(error);
      return vehicleDtos(admin, data ?? [], viewer);
    },
    async listProfileActivities(username, viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id,username,display_name,visibility")
        .eq("username", username)
        .maybeSingle();
      ensure(profileError);
      if (
        !profile ||
        !profile.username ||
        !profile.display_name ||
        !(await isVisibleAccount(admin, profile.id, viewer.canManage)) ||
        (profile.visibility === "private" && profile.id !== viewer.userId && !viewer.canManage)
      )
        return [];
      const eventsResult = await admin
        .from("events")
        .select(
          "id,kind,title,location_label,latitude,longitude,starts_at,ends_at",
        )
        .eq("organizer_id", profile.id)
        .is("deleted_at", null)
        .limit(100);
      ensure(eventsResult.error);
      const author = {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
      };
      const items: ExploreFeatureDto[] = [
        ...(eventsResult.data ?? []).map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          subtitle: row.location_label,
          latitude: row.latitude,
          longitude: row.longitude,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          author,
          canEdit: viewer.canManage || (viewer.canWrite && profile.id === viewer.userId),
        })),
      ];
      return orderProfileActivities(items).slice(0, 100);
    },
    async getVehicle(id, viewerId) {
      const viewer = await viewerCapabilities(admin, viewerId);
      const row = await findVehicle(admin, id);
      if (
        !row ||
        !(await isVisibleAccount(admin, row.owner_id, viewer.canManage)) ||
        (row.owner_id !== viewer.userId && !viewer.canManage &&
          (row.archived_at || row.visibility !== "public"))
      )
        return null;
      return (await vehicleDtos(admin, [row], viewer))[0] ?? null;
    },
    async createVehicle(userId, token, input) {
      await assertReadyMedia(admin, userId, input.mediaIds, "vehicle");
      const { data: id, error } = await owner(token).rpc(
        "save_vehicle_with_media",
        {
          target_vehicle_id: null as unknown as string,
          vehicle_input: vehicleRpcInput(input) as unknown as Json,
          media_ids: [...input.mediaIds],
        },
      );
      ensureWrite(error, id);
      const data = await findVehicle(admin, id!);
      ensureWrite(null, data);
      return (await vehicleDtos(admin, [data!], await viewerCapabilities(admin, userId)))[0]!;
    },
    async updateVehicle(userId, token, id, input) {
      const current = await findVehicle(admin, id);
      const viewer = await viewerCapabilities(admin, userId);
      await assertOwner(current, "owner_id", viewer, "archived_at");
      if (input.mediaIds)
        await assertReadyMedia(admin, userId, input.mediaIds, "vehicle");
      let data;
      if (input.mediaIds) {
        const merged = {
          kind: input.kind ?? current!.kind,
          brand: input.brand ?? current!.brand,
          model: input.model ?? current!.model,
          year: input.year === undefined ? current!.year : input.year,
          nickname:
            input.nickname === undefined ? current!.nickname : input.nickname,
          description:
            input.description === undefined
              ? current!.description
              : input.description,
          visibility: input.visibility ?? current!.visibility,
          mediaIds: input.mediaIds,
        };
        const result = await owner(token).rpc("save_vehicle_with_media", {
          target_vehicle_id: id,
          vehicle_input: vehicleRpcInput(merged) as unknown as Json,
          media_ids: [...input.mediaIds],
        });
        ensureWrite(result.error, result.data);
        data = await findVehicle(admin, result.data!);
        ensureWrite(null, data);
      } else {
        const result = await owner(token)
          .from("vehicles")
          .update(vehiclePatch(input))
          .eq("id", id)
          .is("archived_at", null)
          .select("*")
          .maybeSingle();
        ensureWrite(result.error, result.data);
        data = result.data;
      }
      return (await vehicleDtos(admin, [data!], viewer))[0]!;
    },
    async deleteVehicle(userId, token, id) {
      await assertOwner(
        await findVehicle(admin, id),
        "owner_id",
        await viewerCapabilities(admin, userId),
        "archived_at",
      );
      const { data, error } = await owner(token).rpc(
        "delete_vehicle_permanently",
        { target_vehicle_id: id },
      );
      ensureWrite(error, data);
    },
  };
}

async function findComment(admin: Admin, id: string) {
  const { data, error } = await admin
    .from("comments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  ensure(error);
  return data;
}
async function findVehicle(admin: Admin, id: string) {
  const { data, error } = await admin
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  ensure(error);
  return data;
}

async function authors(
  admin: Admin,
  ids: readonly string[],
  includeSuspended = false,
): Promise<Map<string, ContentAuthorDto>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const [{ data, error }, { data: access, error: accessError }] = await Promise.all([
    admin
    .from("profiles")
    .select("id,username,display_name")
    .in("id", unique),
    admin.from("account_access").select("user_id,status,transition_id").in("user_id", unique),
  ]);
  ensure(error);
  ensure(accessError);
  const statuses = new Map((access ?? []).map((row) => [row.user_id, row]));
  return new Map(
    (data ?? [])
      .filter((row) => {
        const access = statuses.get(row.id);
        return Boolean(row.username && row.display_name && access?.transition_id === null && (includeSuspended || access.status !== "suspended"));
      })
      .map((row) => [
        row.id,
        { id: row.id, username: row.username!, displayName: row.display_name! },
      ]),
  );
}

async function commentDtos(
  admin: Admin,
  rows: Tables<"comments">[],
  viewer: ViewerCapabilities,
): Promise<CommentDto[]> {
  const people = await authors(
    admin,
    rows.flatMap((row) => [
      row.author_id,
      ...(row.reply_to_user_id ? [row.reply_to_user_id] : []),
    ]),
    viewer.canManage,
  );
  return rows.flatMap((row) => {
    const author = people.get(row.author_id);
    if (!author) return [];
    return [
      {
        id: row.id,
        postId: row.post_id,
        body: row.deleted_at ? null : row.body,
        author,
        parentId: row.parent_id,
        replyTo: row.reply_to_user_id
          ? (people.get(row.reply_to_user_id) ?? null)
          : null,
        deleted: Boolean(row.deleted_at),
        canEdit: !row.deleted_at && (viewer.canManage || (viewer.canWrite && row.author_id === viewer.userId)),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    ];
  });
}

async function vehicleDtos(
  admin: Admin,
  rows: Tables<"vehicles">[],
  viewer: ViewerCapabilities,
): Promise<VehicleDto[]> {
  const people = await authors(
    admin,
    rows.map((row) => row.owner_id), viewer.canManage,
  );
  const ids = rows.map((row) => row.id);
  const media = new Map<string, string[]>();
  if (ids.length) {
    const { data, error } = await admin
      .from("vehicle_media")
      .select("vehicle_id,media_id,position")
      .in("vehicle_id", ids)
      .order("position");
    ensure(error);
    for (const link of data ?? [])
      media.set(link.vehicle_id, [
        ...(media.get(link.vehicle_id) ?? []),
        link.media_id,
      ]);
  }
  return rows.flatMap((row) => {
    const owner = people.get(row.owner_id);
    if (!owner) return [];
    return [
      {
        id: row.id,
        owner,
        kind: row.kind,
        brand: row.brand,
        model: row.model,
        year: row.year,
        nickname: row.nickname,
        description: row.description,
        visibility: row.visibility,
        mediaIds: media.get(row.id) ?? [],
        canEdit: viewer.canManage || (viewer.canWrite && row.owner_id === viewer.userId),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    ];
  });
}


function vehicleRpcInput(input: Omit<CreateVehicleInput, "mediaIds">) {
  return {
    kind: input.kind,
    brand: input.brand,
    model: input.model,
    year: input.year,
    nickname: input.nickname,
    description: input.description,
    visibility: input.visibility,
  };
}
function vehiclePatch(input: Partial<CreateVehicleInput>) {
  return {
    ...(input.kind === undefined ? {} : { kind: input.kind }),
    ...(input.brand === undefined ? {} : { brand: input.brand }),
    ...(input.model === undefined ? {} : { model: input.model }),
    ...(input.year === undefined ? {} : { year: input.year }),
    ...(input.nickname === undefined ? {} : { nickname: input.nickname }),
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
  };
}

function orderProfileActivities(
  items: readonly ExploreFeatureDto[],
  now = Date.now(),
) {
  const upcoming = items
    .filter((item) => Date.parse(item.startsAt) >= now)
    .sort(
      (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
    );
  const past = items
    .filter((item) => Date.parse(item.startsAt) < now)
    .sort(
      (left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt),
    );
  return [...upcoming, ...past];
}

async function assertReadyMedia(
  admin: Admin,
  userId: string,
  ids: readonly string[],
  purpose: "vehicle",
) {
  if (!ids.length) return;
  const { data, error } = await admin
    .from("media")
    .select("id,owner_id,status,purpose")
    .in("id", [...new Set(ids)]);
  ensure(error);
  if (
    (data ?? []).length !== new Set(ids).size ||
    (data ?? []).some(
      (row) =>
        row.owner_id !== userId ||
        row.status !== "ready" ||
        row.purpose !== purpose,
    )
  )
    throw failure("CONTENT_FORBIDDEN", 403);
}
async function assertOwner<Row extends Record<Key, string>, Key extends string>(
  row: Row | null,
  key: Key,
  viewer: ViewerCapabilities,
  deletedKey = "deleted_at",
) {
  if (
    !row ||
    (!viewer.canManage && (!viewer.canWrite || row[key] !== viewer.userId)) ||
    (deletedKey in row && row[deletedKey as keyof Row])
  )
    throw failure(
      row ? "CONTENT_FORBIDDEN" : "CONTENT_NOT_FOUND",
      row ? 403 : 404,
    );
}

async function viewerCapabilities(admin: Admin, userId: string | null): Promise<ViewerCapabilities> {
  if (!userId) return { userId: null, canWrite: false, canManage: false };
  const { data, error } = await admin.from("account_access").select("role,status,transition_id").eq("user_id", userId).maybeSingle();
  ensure(error);
  const active = data?.status === "active" && data.transition_id === null;
  return { userId, canWrite: active, canManage: active && data?.role === "admin" };
}

async function isVisibleAccount(admin: Admin, userId: string, includeSuspended: boolean): Promise<boolean> {
  const { data, error } = await admin.from("account_access").select("status,transition_id").eq("user_id", userId).maybeSingle();
  ensure(error);
  return data?.transition_id === null && (includeSuspended || data.status !== "suspended");
}
function ensure(error: { code?: string; message?: string } | null) {
  if (error) throw failure("CONTENT_UNAVAILABLE", 503, error);
}
function ensureWrite(
  error: { code?: string; message?: string } | null,
  data: unknown,
) {
  if (error)
    throw failure(
      error.code === "42501" ? "CONTENT_FORBIDDEN" : "CONTENT_UPDATE_FAILED",
      error.code === "42501" ? 403 : 503,
      error,
    );
  if (!data) throw failure("CONTENT_NOT_FOUND", 404);
}
function failure(code: string, status: number, cause?: unknown) {
  return Object.assign(new Error(code, cause ? { cause } : undefined), {
    code,
    status,
  });
}
