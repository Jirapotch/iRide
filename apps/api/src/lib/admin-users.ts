import {
  authenticateRequest,
  AuthenticationError,
  toAuthErrorBody,
  type AuthContext,
} from "@iride/auth";
import { createAdminDatabaseClient } from "@iride/database/admin";
import type { AccountRole, AccountStatus, CommunityCategory } from "@iride/types";

import {
  enrichAdminUsersWithEmails,
  loadAllAuthUsers,
  searchAdminUserDirectory,
} from "./admin-user-directory";
import { createCorsDecision } from "./cors";

const pageSize = 25;
const permanentBanDuration = "876000h";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminUserDto {
  readonly id: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly role: AccountRole;
  readonly status: AccountStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface AdminUserContentDto {
  readonly id: string;
  readonly kind: "post" | "event" | "photographerSpot" | "vehicle";
  readonly title: string;
  readonly communityCategory?: CommunityCategory;
}

export interface AdminUsersRepository {
  readonly getAccess: (userId: string) => Promise<(Pick<AdminUserDto, "role" | "status"> & { readonly transitionId: string | null }) | null>;
  readonly listUsers: (input: { readonly q: string | null; readonly page: number; readonly pageSize: number }) => Promise<{ readonly data: readonly AdminUserDto[]; readonly total: number }>;
  readonly getUser: (userId: string) => Promise<AdminUserDto | null>;
  readonly listContent: (userId: string) => Promise<readonly AdminUserContentDto[]>;
  readonly beginTransition: (input: { readonly adminId: string; readonly targetId: string; readonly action: AdminAction }) => Promise<Pick<AdminUserDto, "role" | "status" | "updatedAt"> & { readonly token: string; readonly previousStatus: AccountStatus }>;
  readonly finalizeTransition: (input: { readonly adminId: string; readonly targetId: string; readonly token: string }) => Promise<Pick<AdminUserDto, "role" | "status" | "updatedAt">>;
  readonly rollbackTransition: (input: { readonly adminId: string; readonly targetId: string; readonly token: string }) => Promise<void>;
  readonly getPendingTransition: (targetId: string) => Promise<{ readonly token: string; readonly action: string; readonly previousStatus: AccountStatus; readonly status: AccountStatus } | null>;
  readonly recoverStaleTransition: (input: { readonly adminId: string; readonly targetId: string; readonly token: string }) => Promise<Pick<AdminUserDto, "role" | "status" | "updatedAt">>;
  readonly getAccountState: (targetId: string) => Promise<(Pick<AdminUserDto, "role" | "status" | "updatedAt"> & { readonly transitionId: string | null; readonly action: string | null; readonly previousStatus: AccountStatus | null; readonly actorId: string | null }) | null>;
  readonly updateBan: (userId: string, duration: typeof permanentBanDuration | "none") => Promise<void>;
}

export interface AdminUsersDependencies {
  readonly authenticate: (request: Pick<Request, "headers">) => Promise<AuthContext>;
  readonly repository: AdminUsersRepository;
  readonly allowedOrigins?: string;
}

export type AdminAction = "lock" | "unlock" | "suspend" | "restore";
type AdminRequestAction = AdminAction | "recover";

class AdminRequestError extends Error {
  constructor(readonly code: string, readonly status: 400 | 401 | 403 | 404 | 409 | 503) {
    super(code);
    this.name = "AdminRequestError";
  }
}

export async function handleAdminUsers(
  request: Request,
  dependencies: AdminUsersDependencies = productionDependencies(),
): Promise<Response> {
  return withAdminRequest(request, dependencies, "GET, OPTIONS", async () => {
    const url = new URL(request.url);
    const rawPage = url.searchParams.get("page") ?? "1";
    const page = Number(rawPage);
    const q = url.searchParams.get("q")?.trim() || null;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10_000 || (q && q.length > 100)) {
      throw new AdminRequestError("ADMIN_VALIDATION_FAILED", 400);
    }
    const result = await dependencies.repository.listUsers({ q, page, pageSize });
    return { data: result.data, page, pageSize, total: result.total };
  });
}

export async function handleAdminUser(
  request: Request,
  userId: string,
  dependencies: AdminUsersDependencies = productionDependencies(),
): Promise<Response> {
  return withAdminRequest(request, dependencies, "GET, PATCH, OPTIONS", async (actorId) => {
    if (!uuidPattern.test(userId)) throw new AdminRequestError("ADMIN_USER_NOT_FOUND", 404);
    const current = await dependencies.repository.getUser(userId);
    if (!current) throw new AdminRequestError("ADMIN_USER_NOT_FOUND", 404);
    if (request.method === "GET") return { data: { ...current, content: await dependencies.repository.listContent(userId) } };
    if (request.method !== "PATCH") throw new AdminRequestError("ADMIN_METHOD_NOT_ALLOWED", 400);

    const action = await parseAction(request);
    if (action === "recover") {
      return recoverStaleTransition(dependencies.repository, actorId, current, userId);
    }
    if ((action === "lock" || action === "suspend") && actorId === userId) {
      throw new AdminRequestError("ADMIN_SELF_PROTECTED", 403);
    }
    let transition: Awaited<ReturnType<AdminUsersRepository["beginTransition"]>>;
    try {
      transition = await dependencies.repository.beginTransition({ adminId: actorId, targetId: userId, action });
    } catch (error) {
      const state = await reconcileAuthToDatabase(dependencies.repository, userId);
      if (state.transitionId && state.action === action && state.actorId === actorId && state.previousStatus) {
        transition = { role: state.role, status: state.status, updatedAt: state.updatedAt, token: state.transitionId, previousStatus: state.previousStatus };
      } else {
        throw normalizeTransitionError(error);
      }
    }
    if (action === "suspend" || action === "restore") {
      try {
        await dependencies.repository.updateBan(userId, action === "suspend" ? permanentBanDuration : "none");
      } catch {
        const state = await reconcileAuthToDatabase(dependencies.repository, userId);
        if (state.transitionId !== transition.token) {
          if (state.transitionId === null) return { data: { ...current, ...userAccess(state) } };
          throw new AdminRequestError("ADMIN_CONSISTENCY_ERROR", 503);
        }
      }
    }
    const finalized = await finalizeWithReconciliation(dependencies.repository, { adminId: actorId, targetId: userId, token: transition.token });
    return { data: { ...current, ...userAccess(finalized) } };
  });
}

export function handleAdminUsersOptions(
  request: Request,
  allowedOrigins = process.env.CORS_ALLOWED_ORIGINS,
): Response {
  const cors = createCorsDecision(request, allowedOrigins, "GET, PATCH, OPTIONS");
  cors.headers.set("Cache-Control", "private, no-store");
  return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
}

async function withAdminRequest(
  request: Request,
  dependencies: AdminUsersDependencies,
  methods: string,
  operation: (actorId: string) => Promise<Record<string, unknown>>,
): Promise<Response> {
  const cors = createCorsDecision(request, dependencies.allowedOrigins, methods);
  cors.headers.set("Cache-Control", "private, no-store");
  if (!cors.allowed) return errorResponse(new AdminRequestError("CORS_ORIGIN_DENIED", 403), cors.headers);
  try {
    const { userId } = await dependencies.authenticate(request);
    const access = await dependencies.repository.getAccess(userId);
    if (!access || access.role !== "admin" || access.status !== "active" || access.transitionId !== null) {
      throw new AdminRequestError("ADMIN_FORBIDDEN", 403);
    }
    return Response.json(await operation(userId), { headers: cors.headers });
  } catch (error) {
    return errorResponse(error, cors.headers);
  }
}

async function parseAction(request: Request): Promise<AdminRequestAction> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AdminRequestError("ADMIN_VALIDATION_FAILED", 400);
  }
  const action = typeof body === "object" && body !== null ? (body as { action?: unknown }).action : null;
  if (action === "lock" || action === "unlock" || action === "suspend" || action === "restore" || action === "recover") return action;
  throw new AdminRequestError("ADMIN_VALIDATION_FAILED", 400);
}

async function recoverStaleTransition(repository: AdminUsersRepository, adminId: string, current: AdminUserDto, targetId: string) {
  const pending = await repository.getPendingTransition(targetId);
  if (!pending) throw new AdminRequestError("ADMIN_NO_PENDING_TRANSITION", 409);
  try {
    await repository.updateBan(targetId, banDurationFor(pending.previousStatus));
  } catch {
    const state = await reconcileAuthToDatabase(repository, targetId);
    if (state.transitionId !== pending.token) {
      if (state.transitionId === null) return { data: { ...current, ...userAccess(state) } };
      throw new AdminRequestError("ADMIN_CONSISTENCY_ERROR", 503);
    }
    try {
      await repository.updateBan(targetId, banDurationFor(pending.previousStatus));
    } catch {
      await reconcileAuthToDatabase(repository, targetId);
      throw new AdminRequestError("ADMIN_AUTH_SYNC_FAILED", 503);
    }
  }
  try {
    await repository.recoverStaleTransition({ adminId, targetId, token: pending.token });
    return { data: { ...current, ...userAccess(await reconcileAuthToDatabase(repository, targetId)) } };
  } catch (error) {
    const state = await reconcileAuthToDatabase(repository, targetId);
    if (state.transitionId === null) return { data: { ...current, ...userAccess(state) } };
    if (state.transitionId !== pending.token) throw normalizeTransitionError(error);
    try {
      await repository.recoverStaleTransition({ adminId, targetId, token: pending.token });
      return { data: { ...current, ...userAccess(await reconcileAuthToDatabase(repository, targetId)) } };
    } catch (retryError) {
      const retriedState = await reconcileAuthToDatabase(repository, targetId);
      if (retriedState.transitionId === null) return { data: { ...current, ...userAccess(retriedState) } };
      throw normalizeTransitionError(retryError);
    }
  }
}

async function finalizeWithReconciliation(repository: AdminUsersRepository, input: { readonly adminId: string; readonly targetId: string; readonly token: string }) {
  try {
    await repository.finalizeTransition(input);
    return await reconcileAuthToDatabase(repository, input.targetId);
  } catch {
    const state = await reconcileAuthToDatabase(repository, input.targetId);
    if (state.transitionId === null) return state;
    if (state.transitionId !== input.token) throw new AdminRequestError("ADMIN_CONSISTENCY_ERROR", 503);
    try {
      await repository.finalizeTransition(input);
      return await reconcileAuthToDatabase(repository, input.targetId);
    } catch {
      const retriedState = await reconcileAuthToDatabase(repository, input.targetId);
      if (retriedState.transitionId === null) return retriedState;
      throw new AdminRequestError("ADMIN_CONSISTENCY_ERROR", 503);
    }
  }
}

async function reconcileAuthToDatabase(repository: AdminUsersRepository, targetId: string) {
  let state: Awaited<ReturnType<AdminUsersRepository["getAccountState"]>>;
  try {
    state = await repository.getAccountState(targetId);
  } catch {
    throw new AdminRequestError("ADMIN_CONSISTENCY_ERROR", 503);
  }
  if (!state) throw new AdminRequestError("ADMIN_USER_NOT_FOUND", 404);
  try {
    await repository.updateBan(targetId, banDurationForAccountState(state));
  } catch {
    try {
      state = await repository.getAccountState(targetId);
      if (!state) throw new AdminRequestError("ADMIN_USER_NOT_FOUND", 404);
      await repository.updateBan(targetId, banDurationForAccountState(state));
    } catch (error) {
      try {
        await repository.getAccountState(targetId);
      } catch {
        // The original failure is already surfaced as a consistency error.
      }
      if (error instanceof AdminRequestError) throw error;
      throw new AdminRequestError("ADMIN_CONSISTENCY_ERROR", 503);
    }
  }
  return state;
}

function banDurationFor(status: AccountStatus): typeof permanentBanDuration | "none" {
  return status === "suspended" ? permanentBanDuration : "none";
}

function banDurationForAccountState(state: NonNullable<Awaited<ReturnType<AdminUsersRepository["getAccountState"]>>>): typeof permanentBanDuration | "none" {
  return state.transitionId ? permanentBanDuration : banDurationFor(state.status);
}

function userAccess(state: Pick<AdminUserDto, "role" | "status" | "updatedAt">): Pick<AdminUserDto, "role" | "status" | "updatedAt"> {
  return { role: state.role, status: state.status, updatedAt: state.updatedAt };
}

function errorResponse(error: unknown, headers: Headers): Response {
  if (error instanceof AuthenticationError) {
    return Response.json(toAuthErrorBody(error), { status: error.status, headers });
  }
  const known = error instanceof AdminRequestError ? error : new AdminRequestError("ADMIN_UNAVAILABLE", 503);
  return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers });
}

function productionDependencies(): AdminUsersDependencies {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const unavailable = async (): Promise<never> => { throw new AuthenticationError("AUTH_PROVIDER_ERROR"); };
  if (!url || !publishableKey || !serviceRoleKey) {
    return { authenticate: unavailable, repository: new Proxy({}, { get: () => unavailable }) as AdminUsersRepository };
  }
  const admin = createAdminDatabaseClient({ url, serviceRoleKey });
  const repository: AdminUsersRepository = {
    async getAccess(userId) {
      const { data, error } = await admin.from("account_access").select("role,status,transition_id").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? { role: data.role, status: data.status, transitionId: data.transition_id } : null;
    },
    async listUsers({ q, page, pageSize: limit }) {
      if (q) {
        const [profileRows, accessRows, authUsers] = await Promise.all([
          loadAllRows<DirectoryProfileRow>(async (from, to) => {
            const result = await admin.from("profiles").select("id,username,display_name,created_at").range(from, to);
            return { data: result.data, error: result.error };
          }),
          loadAllRows<DirectoryAccessRow>(async (from, to) => {
            const result = await admin.from("account_access").select("user_id,role,status,updated_at").range(from, to);
            return { data: result.data, error: result.error };
          }),
          loadAllAuthUsers((params) => admin.auth.admin.listUsers(params)),
        ]);
        return searchAdminUserDirectory({
          profiles: profileRows.map((profile) => ({ id: profile.id, username: profile.username, displayName: profile.display_name, createdAt: profile.created_at })),
          access: accessRows.map((account) => ({ userId: account.user_id, role: account.role, status: account.status, updatedAt: account.updated_at })),
          authUsers,
          q,
          page,
          pageSize: limit,
        });
      }
      const query = admin.from("profiles").select("id,username,display_name,created_at,updated_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
      const { data: profiles, error, count } = await query;
      if (error) throw error;
      const ids = (profiles ?? []).map((profile) => profile.id);
      const { data: access, error: accessError } = ids.length
        ? await admin.from("account_access").select("user_id,role,status,updated_at").in("user_id", ids)
        : { data: [], error: null };
      if (accessError) throw accessError;
      const byId = new Map((access ?? []).map((row) => [row.user_id, row]));
      return {
        data: await enrichAdminUsersWithEmails((profiles ?? []).flatMap((profile) => {
          const account = byId.get(profile.id);
          return account ? [{ id: profile.id, username: profile.username, displayName: profile.display_name, email: null, role: account.role, status: account.status, createdAt: profile.created_at, updatedAt: account.updated_at }] : [];
        }), (userId) => admin.auth.admin.getUserById(userId)),
        total: count ?? 0,
      };
    },
    async getUser(userId) {
      const [{ data: profile, error: profileError }, { data: access, error: accessError }] = await Promise.all([
        admin.from("profiles").select("id,username,display_name,created_at,updated_at").eq("id", userId).maybeSingle(),
        admin.from("account_access").select("role,status,updated_at").eq("user_id", userId).maybeSingle(),
      ]);
      if (profileError) throw profileError;
      if (accessError) throw accessError;
      if (!profile || !access) return null;
      const [enriched] = await enrichAdminUsersWithEmails([
        { id: profile.id, username: profile.username, displayName: profile.display_name, email: null, role: access.role, status: access.status, createdAt: profile.created_at, updatedAt: access.updated_at },
      ], (id) => admin.auth.admin.getUserById(id));
      return enriched ?? null;
    },
    async listContent(userId) {
      const [posts, events, spots, vehicles] = await Promise.all([
        admin.from("posts").select("id,body,community_category").eq("author_id", userId).is("deleted_at", null),
        admin.from("events").select("id,title").eq("organizer_id", userId).is("deleted_at", null),
        admin.from("photographer_spots").select("id,title").eq("owner_id", userId).is("deleted_at", null),
        admin.from("vehicles").select("id,brand,model").eq("owner_id", userId),
      ]);
      for (const result of [posts, events, spots, vehicles]) if (result.error) throw result.error;
      return [
        ...(posts.data ?? []).map((row) => ({ id: row.id, kind: "post" as const, title: row.body.slice(0, 80), communityCategory: row.community_category })),
        ...(events.data ?? []).map((row) => ({ id: row.id, kind: "event" as const, title: row.title })),
        ...(spots.data ?? []).map((row) => ({ id: row.id, kind: "photographerSpot" as const, title: row.title })),
        ...(vehicles.data ?? []).map((row) => ({ id: row.id, kind: "vehicle" as const, title: `${row.brand} ${row.model}` })),
      ];
    },
    async beginTransition(input) {
      const { data, error } = await admin.rpc("begin_account_access_transition", {
        target_user_id: input.targetId,
        requested_action: input.action,
        actor_id: input.adminId,
      }).single();
      if (error) throw error;
      return { role: data.role, status: data.status, updatedAt: data.updated_at, token: data.transition_token, previousStatus: data.previous_status };
    },
    async rollbackTransition(input) {
      const { error } = await admin.rpc("rollback_account_access_transition", {
        target_user_id: input.targetId,
        actor_id: input.adminId,
        transition_token: input.token,
      });
      if (error) throw error;
    },
    async getPendingTransition(targetId) {
      const { data, error } = await admin
        .from("account_access")
        .select("status,transition_id,transition_action,transition_previous_status")
        .eq("user_id", targetId)
        .maybeSingle();
      if (error) throw error;
      return data?.transition_id && data.transition_action && data.transition_previous_status
        ? { token: data.transition_id, action: data.transition_action, previousStatus: data.transition_previous_status, status: data.status }
        : null;
    },
    async getAccountState(targetId) {
      const { data, error } = await admin
        .from("account_access")
        .select("role,status,updated_at,transition_id,transition_action,transition_previous_status,transition_actor_id")
        .eq("user_id", targetId)
        .maybeSingle();
      if (error) throw error;
      return data ? {
        role: data.role,
        status: data.status,
        updatedAt: data.updated_at,
        transitionId: data.transition_id,
        action: data.transition_action,
        previousStatus: data.transition_previous_status,
        actorId: data.transition_actor_id,
      } : null;
    },
    async recoverStaleTransition(input) {
      const { data, error } = await admin.rpc("recover_stale_account_access_transition", {
        target_user_id: input.targetId,
        recovery_actor_id: input.adminId,
        transition_token: input.token,
      }).single();
      if (error) throw error;
      return { role: data.role, status: data.status, updatedAt: data.updated_at };
    },
    async finalizeTransition(input) {
      const { data, error } = await admin.rpc("finalize_account_access_transition", {
        target_user_id: input.targetId,
        actor_id: input.adminId,
        transition_token: input.token,
      }).single();
      if (error) throw error;
      return { role: data.role, status: data.status, updatedAt: data.updated_at };
    },
    async updateBan(userId, duration) {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: duration });
      if (error) throw error;
    },
  };
  return {
    authenticate: (request) => authenticateRequest(request, { supabaseUrl: url, publishableKey }),
    repository,
    ...(process.env.CORS_ALLOWED_ORIGINS ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS } : {}),
  };
}

async function loadAllRows<T>(readPage: (from: number, to: number) => Promise<{ readonly data: readonly T[] | null; readonly error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

interface DirectoryProfileRow { readonly id: string; readonly username: string | null; readonly display_name: string | null; readonly created_at: string }
interface DirectoryAccessRow { readonly user_id: string; readonly role: AccountRole; readonly status: AccountStatus; readonly updated_at: string }

function normalizeTransitionError(error: unknown): AdminRequestError {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("account_not_found")) return new AdminRequestError("ADMIN_USER_NOT_FOUND", 404);
  if (message.includes("self_protected") || message.includes("admin_forbidden")) return new AdminRequestError("ADMIN_FORBIDDEN", 403);
  if (message.includes("last_active_admin")) return new AdminRequestError("ADMIN_LAST_ACTIVE_ADMIN", 409);
  if (message.includes("invalid_transition") || message.includes("invalid_action")) return new AdminRequestError("ADMIN_INVALID_TRANSITION", 409);
  if (message.includes("transition_in_progress")) return new AdminRequestError("ADMIN_TRANSITION_IN_PROGRESS", 409);
  if (message.includes("transition_token_mismatch")) return new AdminRequestError("ADMIN_CONSISTENCY_ERROR", 503);
  if (message.includes("transition_not_stale")) return new AdminRequestError("ADMIN_TRANSITION_NOT_STALE", 409);
  return new AdminRequestError("ADMIN_UNAVAILABLE", 503);
}
