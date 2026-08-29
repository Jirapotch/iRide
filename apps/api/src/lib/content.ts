import {
  authenticateRequest,
  AuthenticationError,
  parseBearerToken,
  toAuthErrorBody,
  type AuthContext,
} from "@iride/auth";
import type {
  CreateEventInput,
  CreatePhotographerSpotInput,
  CreatePostInput,
  EventDto,
  ExploreFeatureDto,
  PhotographerSpotDto,
  PostDto,
  SearchResultDto,
  UpdateEventInput,
  UpdatePhotographerSpotInput,
  UpdatePostInput,
} from "@iride/types";
import {
  createEventSchema,
  createPhotographerSpotSchema,
  createPostSchema,
  updateEventSchema,
  updatePhotographerSpotSchema,
  updatePostSchema,
} from "@iride/validation";

import { createCorsDecision } from "./cors";
import { createContentRepository } from "./content-repository";

export type ContentDomain = "posts" | "events" | "photographer-spots";
export type ExploreLayer = "events" | "trips" | "photographer-spots";
export type SearchType =
  | "profiles"
  | "posts"
  | "events"
  | "photographer-spots"
  | "market-products";
export interface ExploreBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface ContentRepository {
  readonly listPosts: (viewerId: string | null) => Promise<PostDto[]>;
  readonly getPost: (id: string, viewerId: string | null) => Promise<PostDto | null>;
  readonly createPost: (userId: string, accessToken: string, input: CreatePostInput) => Promise<PostDto>;
  readonly updatePost: (userId: string, accessToken: string, id: string, input: UpdatePostInput) => Promise<PostDto>;
  readonly deletePost: (userId: string, accessToken: string, id: string) => Promise<void>;
  readonly listEvents: (viewerId: string | null) => Promise<EventDto[]>;
  readonly getEvent: (id: string, viewerId: string | null) => Promise<EventDto | null>;
  readonly createEvent: (userId: string, accessToken: string, input: CreateEventInput) => Promise<EventDto>;
  readonly updateEvent: (userId: string, accessToken: string, id: string, input: UpdateEventInput) => Promise<EventDto>;
  readonly deleteEvent: (userId: string, accessToken: string, id: string) => Promise<void>;
  readonly listPhotographerSpots: (viewerId: string | null) => Promise<PhotographerSpotDto[]>;
  readonly getPhotographerSpot: (id: string, viewerId: string | null) => Promise<PhotographerSpotDto | null>;
  readonly createPhotographerSpot: (userId: string, accessToken: string, input: CreatePhotographerSpotInput) => Promise<PhotographerSpotDto>;
  readonly updatePhotographerSpot: (userId: string, accessToken: string, id: string, input: UpdatePhotographerSpotInput) => Promise<PhotographerSpotDto>;
  readonly deletePhotographerSpot: (userId: string, accessToken: string, id: string) => Promise<void>;
  readonly explore: (bounds: ExploreBounds, layers: ExploreLayer[], viewerId: string | null) => Promise<ExploreFeatureDto[]>;
  readonly search: (query: string, types: SearchType[], viewerId: string | null) => Promise<SearchResultDto[]>;
}

export interface ContentDependencies {
  readonly authenticate: (request: Pick<Request, "headers">) => Promise<AuthContext>;
  readonly repository: ContentRepository;
  readonly allowedOrigins?: string;
}

export type ContentErrorCode =
  | "CONTENT_NOT_FOUND"
  | "CONTENT_FORBIDDEN"
  | "CONTENT_VALIDATION_FAILED"
  | "CONTENT_UPDATE_FAILED"
  | "CONTENT_UNAVAILABLE";

export class ContentRequestError extends Error {
  constructor(
    readonly code: ContentErrorCode,
    readonly status: 400 | 403 | 404 | 503,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ContentRequestError";
  }
}

export async function handleContentCollection(
  request: Request,
  domain: ContentDomain,
  dependencies: ContentDependencies = productionDependencies(),
): Promise<Response> {
  return withCors(request, dependencies, async () => {
    if (request.method === "GET") {
      const viewerId = await optionalViewer(request, dependencies);
      const data =
        domain === "posts"
          ? await dependencies.repository.listPosts(viewerId)
          : domain === "events"
            ? await dependencies.repository.listEvents(viewerId)
            : await dependencies.repository.listPhotographerSpots(viewerId);
      return json({ data });
    }
    if (request.method !== "POST") return methodNotAllowed();

    const { userId } = await dependencies.authenticate(request);
    const accessToken = parseBearerToken(request.headers.get("authorization"));
    const body = await readJson(request);
    if (domain === "posts") {
      const input = parseInput<CreatePostInput>(createPostSchema, body);
      return json(
        { data: await dependencies.repository.createPost(userId, accessToken, input) },
        201,
      );
    }
    if (domain === "events") {
      const input = parseInput<CreateEventInput>(createEventSchema, body);
      return json(
        { data: await dependencies.repository.createEvent(userId, accessToken, input) },
        201,
      );
    }
    const input = parseInput<CreatePhotographerSpotInput>(
      createPhotographerSpotSchema,
      body,
    );
    return json(
      {
        data: await dependencies.repository.createPhotographerSpot(
          userId,
          accessToken,
          input,
        ),
      },
      201,
    );
  });
}

export async function handleContentItem(
  request: Request,
  domain: ContentDomain,
  id: string,
  dependencies: ContentDependencies = productionDependencies(),
): Promise<Response> {
  return withCors(request, dependencies, async () => {
    if (!isUuid(id)) throw new ContentRequestError("CONTENT_NOT_FOUND", 404);
    if (request.method === "GET") {
      const viewerId = await optionalViewer(request, dependencies);
      const data =
        domain === "posts"
          ? await dependencies.repository.getPost(id, viewerId)
          : domain === "events"
            ? await dependencies.repository.getEvent(id, viewerId)
            : await dependencies.repository.getPhotographerSpot(id, viewerId);
      if (!data) throw new ContentRequestError("CONTENT_NOT_FOUND", 404);
      return json({ data });
    }
    if (request.method !== "PATCH" && request.method !== "DELETE") {
      return methodNotAllowed();
    }

    const { userId } = await dependencies.authenticate(request);
    const accessToken = parseBearerToken(request.headers.get("authorization"));
    if (request.method === "DELETE") {
      if (domain === "posts") await dependencies.repository.deletePost(userId, accessToken, id);
      else if (domain === "events") await dependencies.repository.deleteEvent(userId, accessToken, id);
      else await dependencies.repository.deletePhotographerSpot(userId, accessToken, id);
      return new Response(null, { status: 204 });
    }

    const body = await readJson(request);
    const data =
      domain === "posts"
        ? await dependencies.repository.updatePost(
            userId,
            accessToken,
            id,
            parseInput<UpdatePostInput>(updatePostSchema, body),
          )
        : domain === "events"
          ? await dependencies.repository.updateEvent(
              userId,
              accessToken,
              id,
              parseInput<UpdateEventInput>(updateEventSchema, body),
            )
          : await dependencies.repository.updatePhotographerSpot(
              userId,
              accessToken,
              id,
              parseInput<UpdatePhotographerSpotInput>(
                updatePhotographerSpotSchema,
                body,
              ),
            );
    return json({ data });
  });
}

export async function handleExplore(
  request: Request,
  dependencies: ContentDependencies = productionDependencies(),
): Promise<Response> {
  return withCors(request, dependencies, async () => {
    const url = new URL(request.url);
    const bounds = parseBounds(url.searchParams.get("bbox"));
    const layers = parseValues<ExploreLayer>(
      url.searchParams.get("layers"),
      ["events", "trips", "photographer-spots"],
      ["events", "trips", "photographer-spots"],
    );
    const viewerId = await optionalViewer(request, dependencies);
    return json({ data: await dependencies.repository.explore(bounds, layers, viewerId) });
  });
}

export async function handleSearch(
  request: Request,
  dependencies: ContentDependencies = productionDependencies(),
): Promise<Response> {
  return withCors(request, dependencies, async () => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (!query || query.length > 100) {
      throw new ContentRequestError("CONTENT_VALIDATION_FAILED", 400);
    }
    const types = parseValues<SearchType>(
      url.searchParams.get("types"),
      ["profiles", "posts", "events", "photographer-spots", "market-products"],
      ["profiles", "posts", "events", "photographer-spots", "market-products"],
    );
    const viewerId = await optionalViewer(request, dependencies);
    return json({ data: await dependencies.repository.search(query, types, viewerId) });
  });
}

export function handleContentOptions(
  request: Request,
  allowedOrigins = process.env.CORS_ALLOWED_ORIGINS,
): Response {
  const cors = createCorsDecision(
    request,
    allowedOrigins,
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  cors.headers.set("Cache-Control", "private, no-store");
  return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
}

async function withCors(
  request: Request,
  dependencies: ContentDependencies,
  operation: () => Promise<Response>,
): Promise<Response> {
  const cors = createCorsDecision(
    request,
    dependencies.allowedOrigins,
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  cors.headers.set("Cache-Control", "private, no-store");
  if (!cors.allowed) return errorResponse(new ContentRequestError("CONTENT_FORBIDDEN", 403), cors.headers);
  try {
    const response = await operation();
    cors.headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(toAuthErrorBody(error), { status: error.status, headers: cors.headers });
    }
    const normalized =
      error instanceof ContentRequestError
        ? error
        : isRepositoryError(error)
          ? new ContentRequestError(
              error.code as ContentErrorCode,
              error.status as 400 | 403 | 404 | 503,
              { cause: error },
            )
        : new ContentRequestError("CONTENT_UPDATE_FAILED", 503, { cause: error });
    return errorResponse(normalized, cors.headers);
  }
}

async function optionalViewer(
  request: Request,
  dependencies: ContentDependencies,
): Promise<string | null> {
  if (!request.headers.has("authorization")) return null;
  return (await dependencies.authenticate(request)).userId;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ContentRequestError("CONTENT_VALIDATION_FAILED", 400);
  }
}

function parseInput<T>(schema: { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ContentRequestError("CONTENT_VALIDATION_FAILED", 400);
  if (typeof parsed.data !== "object" || parsed.data === null) return parsed.data as T;
  return Object.fromEntries(
    Object.entries(parsed.data).filter(([, item]) => item !== undefined),
  ) as T;
}

function parseBounds(value: string | null): ExploreBounds {
  const values = value?.split(",").map(Number) ?? [];
  if (
    values.length !== 4 ||
    values.some((item) => !Number.isFinite(item)) ||
    values[0]! < -180 || values[2]! > 180 || values[1]! < -90 || values[3]! > 90 ||
    values[0]! >= values[2]! || values[1]! >= values[3]!
  ) {
    throw new ContentRequestError("CONTENT_VALIDATION_FAILED", 400);
  }
  return { west: values[0]!, south: values[1]!, east: values[2]!, north: values[3]! };
}

function parseValues<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: readonly T[],
): T[] {
  if (!value) return [...fallback];
  const values = Array.from(new Set(value.split(",")));
  if (!values.length || values.some((item) => !allowed.includes(item as T))) {
    throw new ContentRequestError("CONTENT_VALIDATION_FAILED", 400);
  }
  return values as T[];
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function methodNotAllowed(): Response {
  return Response.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "Method is not allowed." } },
    { status: 405 },
  );
}

function errorResponse(error: ContentRequestError, headers: Headers): Response {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers },
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRepositoryError(
  value: unknown,
): value is { readonly code: ContentErrorCode; readonly status: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "status" in value &&
    typeof value.code === "string" &&
    typeof value.status === "number"
  );
}

function productionDependencies(): ContentDependencies {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const configured = Boolean(supabaseUrl && publishableKey && serviceRoleKey);
  const unavailable = async () => { throw new ContentRequestError("CONTENT_UNAVAILABLE", 503); };
  const repository = configured
    ? createContentRepository({
        url: supabaseUrl!,
        publishableKey: publishableKey!,
        serviceRoleKey: serviceRoleKey!,
      })
    : (new Proxy({}, { get: () => unavailable }) as ContentRepository);
  return {
    authenticate(request) {
      if (!supabaseUrl || !publishableKey) throw new AuthenticationError("AUTH_PROVIDER_ERROR");
      return authenticateRequest(request, { supabaseUrl, publishableKey });
    },
    repository,
    ...(process.env.CORS_ALLOWED_ORIGINS ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS } : {}),
  };
}
