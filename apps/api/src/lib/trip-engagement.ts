import {
  authenticateRequest,
  AuthenticationError,
  parseBearerToken,
  toAuthErrorBody,
} from "@iride/auth";
import type {
  TripEngagementDto,
  TripParticipationStatus,
  TripStop,
} from "@iride/types";
import {
  tripAnnouncementSchema,
  tripParticipationSchema,
  tripRecapEntrySchema,
  tripRecapSchema,
} from "@iride/validation";
import { createCorsDecision } from "./cors";
import { createTripRepository } from "./trip-engagement-repository";

export interface TripRepository {
  get(id: string, viewerId: string | null): Promise<TripEngagementDto | null>;
  saveParticipation(
    userId: string,
    token: string,
    id: string,
    input: {
      status: TripParticipationStatus;
      vehicleId: string | null;
      ridingArea: string | null;
    },
  ): Promise<TripEngagementDto>;
  removeParticipation(
    userId: string,
    token: string,
    id: string,
  ): Promise<TripEngagementDto>;
  announce(
    userId: string,
    token: string,
    id: string,
    body: string,
  ): Promise<TripEngagementDto>;
  complete(
    userId: string,
    token: string,
    id: string,
  ): Promise<TripEngagementDto>;
  saveRecap(
    userId: string,
    token: string,
    id: string,
    input: { summary: string; routePoints: readonly TripStop[] },
  ): Promise<TripEngagementDto>;
  publishRecap(
    userId: string,
    token: string,
    id: string,
  ): Promise<TripEngagementDto>;
  addEntry(
    userId: string,
    token: string,
    id: string,
    input: { stopName: string | null; review: string; mediaIds: string[] },
  ): Promise<TripEngagementDto>;
  removeEntry(
    userId: string,
    token: string,
    id: string,
    entryId: string,
  ): Promise<TripEngagementDto>;
}

export interface TripDependencies {
  authenticate(
    request: Request,
  ): Promise<{ userId: string; accessToken: string }>;
  repository: Partial<TripRepository>;
  allowedOrigins?: string;
}

export class TripError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export function handleTripOptions(request: Request): Response {
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

export async function handleTripEngagement(
  request: Request,
  id: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method !== "GET") return methodNotAllowed();
    const data = await deps.repository.get!(id, await viewerId(request, deps));
    if (!data) throw new TripError("TRIP_NOT_FOUND", 404);
    return Response.json({ data });
  });
}

export async function handleTripParticipation(
  request: Request,
  id: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method !== "POST" && request.method !== "DELETE")
      return methodNotAllowed();
    const { userId, accessToken } = await deps.authenticate(request);
    if (request.method === "DELETE")
      return Response.json({
        data: await deps.repository.removeParticipation!(
          userId,
          accessToken,
          id,
        ),
      });
    const parsed = tripParticipationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) throw new TripError("TRIP_VALIDATION_FAILED", 400);
    return Response.json({
      data: await deps.repository.saveParticipation!(
        userId,
        accessToken,
        id,
        parsed.data,
      ),
    });
  });
}

export async function handleTripAnnouncement(
  request: Request,
  id: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method !== "POST") return methodNotAllowed();
    const { userId, accessToken } = await deps.authenticate(request);
    const parsed = tripAnnouncementSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) throw new TripError("TRIP_VALIDATION_FAILED", 400);
    return Response.json({
      data: await deps.repository.announce!(
        userId,
        accessToken,
        id,
        parsed.data.body,
      ),
    });
  });
}

export async function handleTripCompletion(
  request: Request,
  id: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method !== "POST") return methodNotAllowed();
    const { userId, accessToken } = await deps.authenticate(request);
    return Response.json({
      data: await deps.repository.complete!(userId, accessToken, id),
    });
  });
}

export async function handleTripRecap(
  request: Request,
  id: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method === "GET") {
      const data = await deps.repository.get!(
        id,
        await viewerId(request, deps),
      );
      if (!data?.recap || (!data.recap.publishedAt && !data.canOrganize))
        throw new TripError("TRIP_RECAP_NOT_FOUND", 404);
      return Response.json({ data: data.recap });
    }
    if (request.method !== "POST") return methodNotAllowed();
    const { userId, accessToken } = await deps.authenticate(request);
    const parsed = tripRecapSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) throw new TripError("TRIP_VALIDATION_FAILED", 400);
    return Response.json({
      data: await deps.repository.saveRecap!(
        userId,
        accessToken,
        id,
        parsed.data,
      ),
    });
  });
}

export async function handleTripRecapPublish(
  request: Request,
  id: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method !== "POST") return methodNotAllowed();
    const { userId, accessToken } = await deps.authenticate(request);
    return Response.json({
      data: await deps.repository.publishRecap!(userId, accessToken, id),
    });
  });
}

export async function handleTripRecapEntries(
  request: Request,
  id: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method !== "POST") return methodNotAllowed();
    const { userId, accessToken } = await deps.authenticate(request);
    const parsed = tripRecapEntrySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) throw new TripError("TRIP_VALIDATION_FAILED", 400);
    return Response.json(
      {
        data: await deps.repository.addEntry!(
          userId,
          accessToken,
          id,
          parsed.data,
        ),
      },
      { status: 201 },
    );
  });
}

export async function handleTripRecapEntry(
  request: Request,
  id: string,
  entryId: string,
  deps = productionDependencies(),
) {
  return respond(request, id, deps, async () => {
    if (request.method !== "DELETE") return methodNotAllowed();
    if (!uuid(entryId)) throw new TripError("TRIP_RECAP_ENTRY_NOT_FOUND", 404);
    const { userId, accessToken } = await deps.authenticate(request);
    return Response.json({
      data: await deps.repository.removeEntry!(
        userId,
        accessToken,
        id,
        entryId,
      ),
    });
  });
}

async function respond(
  request: Request,
  id: string,
  deps: TripDependencies,
  operation: () => Promise<Response>,
): Promise<Response> {
  const cors = createCorsDecision(
    request,
    deps.allowedOrigins,
    "GET, POST, DELETE, OPTIONS",
  );
  cors.headers.set("Cache-Control", "private, no-store");
  if (!cors.allowed)
    return Response.json(
      { error: { code: "TRIP_FORBIDDEN" } },
      { status: 403, headers: cors.headers },
    );
  try {
    if (!uuid(id)) throw new TripError("TRIP_NOT_FOUND", 404);
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
      error instanceof TripError
        ? error
        : new TripError("TRIP_UNAVAILABLE", 503);
    return Response.json(
      { error: { code: failure.code } },
      { status: failure.status, headers: cors.headers },
    );
  }
}

async function viewerId(
  request: Request,
  deps: TripDependencies,
): Promise<string | null> {
  return request.headers.has("authorization")
    ? (await deps.authenticate(request)).userId
    : null;
}
function methodNotAllowed() {
  return Response.json(
    { error: { code: "METHOD_NOT_ALLOWED" } },
    { status: 405 },
  );
}
function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function productionDependencies(): TripDependencies {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !publishableKey || !serviceRoleKey)
    return {
      authenticate: async () => {
        throw new TripError("TRIP_UNAVAILABLE", 503);
      },
      repository: {},
    };
  return {
    authenticate: async (request) => ({
      userId: (
        await authenticateRequest(request, { supabaseUrl: url, publishableKey })
      ).userId,
      accessToken: parseBearerToken(request.headers.get("authorization")),
    }),
    repository: createTripRepository({ url, publishableKey, serviceRoleKey }),
    ...(process.env.CORS_ALLOWED_ORIGINS
      ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS }
      : {}),
  };
}
