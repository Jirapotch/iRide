import {
  authenticateRequest,
  AuthenticationError,
  toAuthErrorBody,
  type AuthContext,
} from "@iride/auth";
import { createAdminDatabaseClient } from "@iride/database/admin";
import type { AccountRole, AccountStatus } from "@iride/types";

import { createCorsDecision } from "./cors";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ModeratedResourceKind = "post" | "event" | "vehicle";

export interface AdminModerationRepository {
  readonly getAccess: (userId: string) => Promise<{ readonly role: AccountRole; readonly status: AccountStatus; readonly transitionId: string | null } | null>;
  readonly moderateDelete: (input: { readonly actorId: string; readonly targetId: string; readonly kind: ModeratedResourceKind }) => Promise<void>;
}

export interface AdminModerationDependencies {
  readonly authenticate: (request: Pick<Request, "headers">) => Promise<AuthContext>;
  readonly repository: AdminModerationRepository;
  readonly allowedOrigins?: string;
}

class AdminModerationError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 503) {
    super(code);
  }
}

export async function handleAdminModeration(
  request: Request,
  dependencies: AdminModerationDependencies = productionDependencies(),
): Promise<Response> {
  const cors = createCorsDecision(request, dependencies.allowedOrigins, "DELETE, OPTIONS");
  cors.headers.set("Cache-Control", "private, no-store");
  if (!cors.allowed) return errorResponse(new AdminModerationError("CORS_ORIGIN_DENIED", 403), cors.headers);
  try {
    if (request.method !== "DELETE") throw new AdminModerationError("ADMIN_METHOD_NOT_ALLOWED", 400);
    const { userId } = await dependencies.authenticate(request);
    const access = await dependencies.repository.getAccess(userId);
    if (!access || access.role !== "admin" || access.status !== "active" || access.transitionId !== null) {
      throw new AdminModerationError("ADMIN_FORBIDDEN", 403);
    }
    const input = await readInput(request);
    await dependencies.repository.moderateDelete({ actorId: userId, targetId: input.id, kind: input.kind });
    return new Response(null, { status: 204, headers: cors.headers });
  } catch (error) {
    return errorResponse(error, cors.headers);
  }
}

export function handleAdminModerationOptions(request: Request, allowedOrigins = process.env.CORS_ALLOWED_ORIGINS): Response {
  const cors = createCorsDecision(request, allowedOrigins, "DELETE, OPTIONS");
  cors.headers.set("Cache-Control", "private, no-store");
  return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
}

async function readInput(request: Request): Promise<{ readonly id: string; readonly kind: ModeratedResourceKind }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AdminModerationError("ADMIN_VALIDATION_FAILED", 400);
  }
  const id = typeof body === "object" && body !== null ? (body as { id?: unknown }).id : null;
  const kind = typeof body === "object" && body !== null ? (body as { kind?: unknown }).kind : null;
  if (typeof id !== "string" || !uuidPattern.test(id) || (kind !== "post" && kind !== "event" && kind !== "vehicle")) {
    throw new AdminModerationError("ADMIN_VALIDATION_FAILED", 400);
  }
  return { id, kind };
}

function errorResponse(error: unknown, headers: Headers): Response {
  if (error instanceof AuthenticationError) return Response.json(toAuthErrorBody(error), { status: error.status, headers });
  const known = error instanceof AdminModerationError ? error : new AdminModerationError("ADMIN_UNAVAILABLE", 503);
  return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers });
}

function productionDependencies(): AdminModerationDependencies {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const unavailable = async (): Promise<never> => { throw new AuthenticationError("AUTH_PROVIDER_ERROR"); };
  if (!url || !publishableKey || !serviceRoleKey) {
    return { authenticate: unavailable, repository: new Proxy({}, { get: () => unavailable }) as AdminModerationRepository };
  }
  const admin = createAdminDatabaseClient({ url, serviceRoleKey });
  return {
    authenticate: (request) => authenticateRequest(request, { supabaseUrl: url, publishableKey }),
    repository: {
      async getAccess(userId) {
        const { data, error } = await admin.from("account_access").select("role,status,transition_id").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        return data ? { role: data.role, status: data.status, transitionId: data.transition_id } : null;
      },
      async moderateDelete(input) {
        const { error } = await admin.rpc("delete_admin_moderated_resource", {
          moderator_id: input.actorId,
          target_resource_id: input.targetId,
          resource_kind: input.kind,
        });
        if (error) throw error;
      },
    },
    ...(process.env.CORS_ALLOWED_ORIGINS ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS } : {}),
  };
}
