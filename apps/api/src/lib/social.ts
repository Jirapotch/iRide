import {
  authenticateRequest,
  AuthenticationError,
  parseBearerToken,
  toAuthErrorBody,
  type AuthContext,
} from "@iride/auth";
import type {
  CommentDto,
  CreateCommentInput,
  CreateMarketProductInput,
  CreateVehicleInput,
  ExploreFeatureDto,
  MarketProductDto,
  UpdateCommentInput,
  UpdateMarketProductInput,
  UpdateVehicleInput,
  VehicleDto,
} from "@iride/types";
import {
  createCommentSchema,
  createMarketProductSchema,
  createVehicleSchema,
  updateCommentSchema,
  updateMarketProductSchema,
  updateVehicleSchema,
} from "@iride/validation";

import { createCorsDecision } from "./cors";
import { createSocialRepository } from "./social-repository";

export interface SocialRepository {
  readonly listComments: (
    postId: string,
    viewerId: string | null,
  ) => Promise<CommentDto[]>;
  readonly createComment: (
    userId: string,
    token: string,
    postId: string,
    input: CreateCommentInput,
  ) => Promise<CommentDto>;
  readonly updateComment: (
    userId: string,
    token: string,
    id: string,
    input: UpdateCommentInput,
  ) => Promise<CommentDto>;
  readonly deleteComment: (
    userId: string,
    token: string,
    id: string,
  ) => Promise<void>;
  readonly listGarage: (
    username: string,
    viewerId: string | null,
  ) => Promise<VehicleDto[]>;
  readonly listProfileActivities: (
    username: string,
    viewerId: string | null,
  ) => Promise<ExploreFeatureDto[]>;
  readonly getVehicle: (
    id: string,
    viewerId: string | null,
  ) => Promise<VehicleDto | null>;
  readonly createVehicle: (
    userId: string,
    token: string,
    input: CreateVehicleInput,
  ) => Promise<VehicleDto>;
  readonly updateVehicle: (
    userId: string,
    token: string,
    id: string,
    input: UpdateVehicleInput,
  ) => Promise<VehicleDto>;
  readonly deleteVehicle: (
    userId: string,
    token: string,
    id: string,
  ) => Promise<void>;
  readonly listMarketProducts: (
    viewerId: string | null,
  ) => Promise<MarketProductDto[]>;
  readonly getMarketProduct: (
    id: string,
    viewerId: string | null,
  ) => Promise<MarketProductDto | null>;
  readonly createMarketProduct: (
    userId: string,
    token: string,
    input: CreateMarketProductInput,
  ) => Promise<MarketProductDto>;
  readonly updateMarketProduct: (
    userId: string,
    token: string,
    id: string,
    input: UpdateMarketProductInput,
  ) => Promise<MarketProductDto>;
  readonly deleteMarketProduct: (
    userId: string,
    token: string,
    id: string,
  ) => Promise<void>;
}

export interface SocialDependencies {
  readonly authenticate: (
    request: Pick<Request, "headers">,
  ) => Promise<AuthContext>;
  readonly repository: SocialRepository;
  readonly allowedOrigins?: string;
}

class SocialRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(code, options);
  }
}

export function handleCommentsCollection(
  request: Request,
  postId: string,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    requireUuid(postId);
    if (request.method === "GET")
      return json({
        data: await dependencies.repository.listComments(
          postId,
          await optionalViewer(request, dependencies),
        ),
      });
    if (request.method !== "POST") return methodNotAllowed();
    const user = await dependencies.authenticate(request);
    const input = await validated<CreateCommentInput>(
      request,
      createCommentSchema,
    );
    return json(
      {
        data: await dependencies.repository.createComment(
          user.userId,
          token(request),
          postId,
          input,
        ),
      },
      201,
    );
  });
}

export function handleCommentItem(
  request: Request,
  id: string,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    requireUuid(id);
    if (request.method !== "PATCH" && request.method !== "DELETE")
      return methodNotAllowed();
    const user = await dependencies.authenticate(request);
    if (request.method === "DELETE") {
      await dependencies.repository.deleteComment(
        user.userId,
        token(request),
        id,
      );
      return new Response(null, { status: 204 });
    }
    const input = await validated<UpdateCommentInput>(
      request,
      updateCommentSchema,
    );
    return json({
      data: await dependencies.repository.updateComment(
        user.userId,
        token(request),
        id,
        input,
      ),
    });
  });
}

export function handleGarage(
  request: Request,
  username: string,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    if (request.method !== "GET") return methodNotAllowed();
    return json({
      data: await dependencies.repository.listGarage(
        username,
        await optionalViewer(request, dependencies),
      ),
    });
  });
}

export function handleProfileActivities(
  request: Request,
  username: string,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    if (request.method !== "GET") return methodNotAllowed();
    return json({
      data: await dependencies.repository.listProfileActivities(
        username,
        await optionalViewer(request, dependencies),
      ),
    });
  });
}

export function handleVehicleCollection(
  request: Request,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    if (request.method !== "POST") return methodNotAllowed();
    const user = await dependencies.authenticate(request);
    const input = await validated<CreateVehicleInput>(
      request,
      createVehicleSchema,
    );
    return json(
      {
        data: await dependencies.repository.createVehicle(
          user.userId,
          token(request),
          input,
        ),
      },
      201,
    );
  });
}

export function handleVehicleItem(
  request: Request,
  id: string,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    requireUuid(id);
    if (request.method === "GET") {
      const data = await dependencies.repository.getVehicle(
        id,
        await optionalViewer(request, dependencies),
      );
      if (!data) throw new SocialRequestError("CONTENT_NOT_FOUND", 404);
      return json({ data });
    }
    if (request.method !== "PATCH" && request.method !== "DELETE")
      return methodNotAllowed();
    const user = await dependencies.authenticate(request);
    if (request.method === "DELETE") {
      await dependencies.repository.deleteVehicle(
        user.userId,
        token(request),
        id,
      );
      return new Response(null, { status: 204 });
    }
    const input = await validated<UpdateVehicleInput>(
      request,
      updateVehicleSchema,
    );
    return json({
      data: await dependencies.repository.updateVehicle(
        user.userId,
        token(request),
        id,
        input,
      ),
    });
  });
}

export function handleMarketCollection(
  request: Request,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    if (request.method === "GET")
      return json({
        data: await dependencies.repository.listMarketProducts(
          await optionalViewer(request, dependencies),
        ),
      });
    if (request.method !== "POST") return methodNotAllowed();
    const user = await dependencies.authenticate(request);
    const input = await validated<CreateMarketProductInput>(
      request,
      createMarketProductSchema,
    );
    return json(
      {
        data: await dependencies.repository.createMarketProduct(
          user.userId,
          token(request),
          input,
        ),
      },
      201,
    );
  });
}

export function handleMarketItem(
  request: Request,
  id: string,
  dependencies = productionDependencies(),
) {
  return execute(request, dependencies, async () => {
    requireUuid(id);
    if (request.method === "GET") {
      const data = await dependencies.repository.getMarketProduct(
        id,
        await optionalViewer(request, dependencies),
      );
      if (!data) throw new SocialRequestError("CONTENT_NOT_FOUND", 404);
      return json({ data });
    }
    if (request.method !== "PATCH" && request.method !== "DELETE")
      return methodNotAllowed();
    const user = await dependencies.authenticate(request);
    if (request.method === "DELETE") {
      await dependencies.repository.deleteMarketProduct(
        user.userId,
        token(request),
        id,
      );
      return new Response(null, { status: 204 });
    }
    const input = await validated<UpdateMarketProductInput>(
      request,
      updateMarketProductSchema,
    );
    return json({
      data: await dependencies.repository.updateMarketProduct(
        user.userId,
        token(request),
        id,
        input,
      ),
    });
  });
}

export function handleSocialOptions(
  request: Request,
  allowedOrigins = process.env.CORS_ALLOWED_ORIGINS,
) {
  const cors = createCorsDecision(
    request,
    allowedOrigins,
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  return new Response(null, {
    status: cors.allowed ? 204 : 403,
    headers: cors.headers,
  });
}

async function execute(
  request: Request,
  dependencies: SocialDependencies,
  operation: () => Promise<Response>,
) {
  const cors = createCorsDecision(
    request,
    dependencies.allowedOrigins,
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  if (!cors.allowed) return jsonError("CONTENT_FORBIDDEN", 403, cors.headers);
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
    const candidate = error as { code?: string; status?: number };
    const normalized =
      error instanceof SocialRequestError
        ? error
        : candidate?.code && candidate?.status
          ? new SocialRequestError(candidate.code, candidate.status, {
              cause: error,
            })
          : new SocialRequestError("CONTENT_UPDATE_FAILED", 503, {
              cause: error,
            });
    return jsonError(normalized.code, normalized.status, cors.headers);
  }
}

async function validated<T>(
  request: Request,
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: unknown } | { success: false };
  },
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new SocialRequestError("CONTENT_VALIDATION_FAILED", 400);
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new SocialRequestError("CONTENT_VALIDATION_FAILED", 400);
  return result.data as T;
}

async function optionalViewer(
  request: Request,
  dependencies: SocialDependencies,
) {
  return request.headers.has("authorization")
    ? (await dependencies.authenticate(request)).userId
    : null;
}
function token(request: Request) {
  return parseBearerToken(request.headers.get("authorization"));
}
function requireUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new SocialRequestError("CONTENT_NOT_FOUND", 404);
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}
function jsonError(code: string, status: number, headers?: Headers) {
  return Response.json(
    { error: { code, message: code } },
    { status, ...(headers ? { headers } : {}) },
  );
}
function methodNotAllowed() {
  return jsonError("METHOD_NOT_ALLOWED", 405);
}

function productionDependencies(): SocialDependencies {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !publishableKey || !serviceRoleKey) {
    const unavailable = async (): Promise<never> => {
      throw new SocialRequestError("CONTENT_UNAVAILABLE", 503);
    };
    return {
      authenticate: unavailable,
      repository: new Proxy({}, { get: () => unavailable }) as SocialRepository,
    };
  }
  return {
    authenticate: (request) =>
      authenticateRequest(request, { supabaseUrl: url, publishableKey }),
    repository: createSocialRepository({ url, publishableKey, serviceRoleKey }),
    ...(process.env.CORS_ALLOWED_ORIGINS
      ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS }
      : {}),
  };
}
