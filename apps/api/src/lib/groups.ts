import {
  authenticateRequest,
  AuthenticationError,
  parseBearerToken,
  toAuthErrorBody,
} from "@iride/auth";
import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type { CreateRideGroupInput, RideGroupDto } from "@iride/types";
import { createRideGroupSchema } from "@iride/validation";

import { createCorsDecision } from "./cors";

interface GroupRepository {
  list(viewerId: string | null): Promise<RideGroupDto[]>;
  get(slug: string, viewerId: string | null): Promise<RideGroupDto | null>;
  create(
    userId: string,
    accessToken: string,
    input: CreateRideGroupInput,
  ): Promise<RideGroupDto>;
  join(
    userId: string,
    accessToken: string,
    slug: string,
  ): Promise<RideGroupDto>;
  leave(
    userId: string,
    accessToken: string,
    slug: string,
  ): Promise<RideGroupDto>;
}

interface GroupDependencies {
  authenticate(
    request: Request,
  ): Promise<{ userId: string; accessToken: string }>;
  repository: GroupRepository;
  allowedOrigins?: string;
}

class GroupError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export async function handleGroupCollection(
  request: Request,
  dependencies = productionDependencies(),
): Promise<Response> {
  return respond(request, dependencies, async () => {
    if (request.method === "GET") {
      return Response.json({
        data: await dependencies.repository.list(
          await viewerId(request, dependencies),
        ),
      });
    }
    if (request.method !== "POST") return methodNotAllowed();
    const { userId, accessToken } = await dependencies.authenticate(request);
    const body = await request.json().catch(() => null);
    const parsed = createRideGroupSchema.safeParse(body);
    if (!parsed.success) throw new GroupError("GROUP_VALIDATION_FAILED", 400);
    return Response.json(
      {
        data: await dependencies.repository.create(
          userId,
          accessToken,
          parsed.data,
        ),
      },
      { status: 201 },
    );
  });
}

export async function handleGroupItem(
  request: Request,
  slug: string,
  dependencies = productionDependencies(),
): Promise<Response> {
  return respond(request, dependencies, async () => {
    if (request.method !== "GET") return methodNotAllowed();
    if (!validSlug(slug)) throw new GroupError("GROUP_NOT_FOUND", 404);
    const group = await dependencies.repository.get(
      slug,
      await viewerId(request, dependencies),
    );
    if (!group) throw new GroupError("GROUP_NOT_FOUND", 404);
    return Response.json({ data: group });
  });
}

export async function handleGroupMembership(
  request: Request,
  slug: string,
  dependencies = productionDependencies(),
): Promise<Response> {
  return respond(request, dependencies, async () => {
    if (request.method !== "POST" && request.method !== "DELETE")
      return methodNotAllowed();
    if (!validSlug(slug)) throw new GroupError("GROUP_NOT_FOUND", 404);
    const { userId, accessToken } = await dependencies.authenticate(request);
    const data =
      request.method === "POST"
        ? await dependencies.repository.join(userId, accessToken, slug)
        : await dependencies.repository.leave(userId, accessToken, slug);
    return Response.json({ data });
  });
}

export function handleGroupsOptions(request: Request): Response {
  const cors = createCorsDecision(
    request,
    process.env.CORS_ALLOWED_ORIGINS,
    "GET, POST, DELETE, OPTIONS",
  );
  cors.headers.set("Cache-Control", "private, no-store");
  return new Response(null, {
    status: cors.allowed ? 204 : 403,
    headers: cors.headers,
  });
}

async function respond(
  request: Request,
  dependencies: GroupDependencies,
  operation: () => Promise<Response>,
): Promise<Response> {
  const cors = createCorsDecision(
    request,
    dependencies.allowedOrigins,
    "GET, POST, DELETE, OPTIONS",
  );
  cors.headers.set("Cache-Control", "private, no-store");
  if (!cors.allowed)
    return Response.json(
      { error: { code: "GROUP_FORBIDDEN" } },
      { status: 403, headers: cors.headers },
    );
  try {
    const response = await operation();
    cors.headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch (error) {
    if (error instanceof AuthenticationError)
      return Response.json(toAuthErrorBody(error), {
        status: error.status,
        headers: cors.headers,
      });
    const failure =
      error instanceof GroupError
        ? error
        : new GroupError("GROUP_UNAVAILABLE", 503);
    return Response.json(
      { error: { code: failure.code } },
      { status: failure.status, headers: cors.headers },
    );
  }
}

async function viewerId(
  request: Request,
  dependencies: GroupDependencies,
): Promise<string | null> {
  return request.headers.has("authorization")
    ? (await dependencies.authenticate(request)).userId
    : null;
}

function methodNotAllowed() {
  return Response.json(
    { error: { code: "METHOD_NOT_ALLOWED" } },
    { status: 405 },
  );
}
function validSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{2,59}$/.test(value);
}

function productionDependencies(): GroupDependencies {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !publishableKey || !serviceRoleKey) {
    return {
      authenticate: async () => {
        throw new GroupError("GROUP_UNAVAILABLE", 503);
      },
      repository: new Proxy({} as GroupRepository, {
        get: () => async () => {
          throw new GroupError("GROUP_UNAVAILABLE", 503);
        },
      }),
    };
  }
  const config = { url, publishableKey, serviceRoleKey };
  const admin = createAdminDatabaseClient(config);
  const owner = (accessToken: string) =>
    createServerDatabaseClient({ url, publishableKey, accessToken });
  const load = async (
    rows: readonly {
      id: string;
      slug: string;
      name: string;
      description: string;
      creator_id: string | null;
      created_at: string;
    }[],
    viewer: string | null,
  ): Promise<RideGroupDto[]> => {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const { data: memberships, error } = await admin
      .from("ride_group_members")
      .select("group_id,user_id")
      .in("group_id", ids);
    if (error) throw new GroupError("GROUP_UNAVAILABLE", 503);
    const userIds = [
      ...new Set((memberships ?? []).map((member) => member.user_id)),
    ];
    const { data: profiles, error: profileError } = userIds.length
      ? await admin
          .from("profiles")
          .select("id,username,display_name")
          .in("id", userIds)
      : { data: [], error: null };
    if (profileError) throw new GroupError("GROUP_UNAVAILABLE", 503);
    const { data: accessRows, error: accessError } = userIds.length
      ? await admin
          .from("account_access")
          .select("user_id,status,transition_id")
          .in("user_id", userIds)
      : { data: [], error: null };
    if (accessError) throw new GroupError("GROUP_UNAVAILABLE", 503);
    const visibleUsers = new Set(
      (accessRows ?? [])
        .filter(
          (row) => row.status !== "suspended" && row.transition_id === null,
        )
        .map((row) => row.user_id),
    );
    const people = new Map(
      (profiles ?? [])
        .filter((profile) => visibleUsers.has(profile.id))
        .map((profile) => [profile.id, profile]),
    );
    return rows.map((row) => {
      const groupMembers = (memberships ?? []).filter(
        (member) => member.group_id === row.id,
      );
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        creatorId: row.creator_id,
        createdAt: row.created_at,
        memberCount: groupMembers.length,
        isMember: groupMembers.some((member) => member.user_id === viewer),
        members: groupMembers.flatMap((member) => {
          const profile = people.get(member.user_id);
          return profile?.username && profile.display_name
            ? [
                {
                  id: profile.id,
                  username: profile.username,
                  displayName: profile.display_name,
                },
              ]
            : [];
        }),
      };
    });
  };
  const get = async (slug: string, viewer: string | null) => {
    const { data, error } = await admin
      .from("ride_groups")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new GroupError("GROUP_UNAVAILABLE", 503);
    return data ? ((await load([data], viewer))[0] ?? null) : null;
  };
  const requireGroup = async (slug: string, viewer: string | null) => {
    const group = await get(slug, viewer);
    if (!group) throw new GroupError("GROUP_NOT_FOUND", 404);
    return group;
  };
  const repository: GroupRepository = {
    async list(viewer) {
      const { data, error } = await admin
        .from("ride_groups")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw new GroupError("GROUP_UNAVAILABLE", 503);
      return load(data ?? [], viewer);
    },
    get,
    async create(userId, accessToken, input) {
      const slug = `group-${crypto.randomUUID().slice(0, 8)}`;
      const { error } = await owner(accessToken).from("ride_groups").insert({
        slug,
        name: input.name,
        description: input.description,
        creator_id: userId,
      });
      if (error)
        throw new GroupError(
          error.code === "42501" ? "GROUP_FORBIDDEN" : "GROUP_UNAVAILABLE",
          error.code === "42501" ? 403 : 503,
        );
      return requireGroup(slug, userId);
    },
    async join(userId, accessToken, slug) {
      const group = await requireGroup(slug, userId);
      const { error } = await owner(accessToken)
        .from("ride_group_members")
        .upsert({ group_id: group.id, user_id: userId });
      if (error)
        throw new GroupError(
          error.code === "42501" ? "GROUP_FORBIDDEN" : "GROUP_UNAVAILABLE",
          error.code === "42501" ? 403 : 503,
        );
      return requireGroup(slug, userId);
    },
    async leave(userId, accessToken, slug) {
      const group = await requireGroup(slug, userId);
      if (group.creatorId === userId)
        throw new GroupError("GROUP_CREATOR_MUST_REMAIN", 403);
      const { error } = await owner(accessToken)
        .from("ride_group_members")
        .delete()
        .eq("group_id", group.id)
        .eq("user_id", userId);
      if (error) throw new GroupError("GROUP_UNAVAILABLE", 503);
      return requireGroup(slug, userId);
    },
  };
  return {
    authenticate: async (request) => ({
      userId: (
        await authenticateRequest(request, { supabaseUrl: url, publishableKey })
      ).userId,
      accessToken: parseBearerToken(request.headers.get("authorization")),
    }),
    repository,
    ...(process.env.CORS_ALLOWED_ORIGINS
      ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS }
      : {}),
  };
}
