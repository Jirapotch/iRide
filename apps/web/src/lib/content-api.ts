import type {
  CreateEventInput,
  CreateCommentInput,
  CreateMarketProductInput,
  CreatePhotographerSpotInput,
  CreatePostInput,
  CreateVehicleInput,
  CommentDto,
  EventDto,
  ExploreFeatureDto,
  PhotographerSpotDto,
  PostDto,
  MarketProductDto,
  MediaUploadAuthorizationDto,
  MediaUploadRequest,
  SearchResultDto,
  UpdateEventInput,
  UpdatePhotographerSpotInput,
  UpdatePostInput,
  UpdateCommentInput,
  UpdateMarketProductInput,
  UpdateVehicleInput,
  VehicleDto,
} from "@iride/types";

export class ContentApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "ContentApiError";
  }
}

export function getPosts(accessToken?: string) {
  return contentGet<PostDto[]>("/api/v1/posts", accessToken);
}

export function getEvents(accessToken?: string) {
  return contentGet<EventDto[]>("/api/v1/events", accessToken);
}

export function getPhotographerSpots(accessToken?: string) {
  return contentGet<PhotographerSpotDto[]>("/api/v1/photographer-spots", accessToken);
}

export function getComments(postId:string,accessToken?:string){return contentGet<CommentDto[]>(`/api/v1/posts/${encodeURIComponent(postId)}/comments`,accessToken)}
export function createComment(accessToken:string,postId:string,input:CreateCommentInput){return contentMutation<CommentDto>(`/api/v1/posts/${encodeURIComponent(postId)}/comments`,accessToken,"POST",input)}
export function updateComment(accessToken:string,id:string,input:UpdateCommentInput){return contentMutation<CommentDto>(`/api/v1/comments/${encodeURIComponent(id)}`,accessToken,"PATCH",input)}
export function deleteComment(accessToken:string,id:string){return contentDelete(`/api/v1/comments/${encodeURIComponent(id)}`,accessToken)}
export function getGarage(username:string,accessToken?:string){return contentGet<VehicleDto[]>(`/api/v1/users/${encodeURIComponent(username)}/garage`,accessToken)}
export function getVehicle(id:string,accessToken?:string){return contentGet<VehicleDto>(`/api/v1/vehicles/${encodeURIComponent(id)}`,accessToken)}
export function createVehicle(accessToken:string,input:CreateVehicleInput){return contentMutation<VehicleDto>("/api/v1/vehicles",accessToken,"POST",input)}
export function updateVehicle(accessToken:string,id:string,input:UpdateVehicleInput){return contentMutation<VehicleDto>(`/api/v1/vehicles/${encodeURIComponent(id)}`,accessToken,"PATCH",input)}
export function deleteVehicle(accessToken:string,id:string){return contentDelete(`/api/v1/vehicles/${encodeURIComponent(id)}`,accessToken)}
export function getMarketProducts(accessToken?:string){return contentGet<MarketProductDto[]>("/api/v1/market-products",accessToken)}
export function getMarketProduct(id:string,accessToken?:string){return contentGet<MarketProductDto>(`/api/v1/market-products/${encodeURIComponent(id)}`,accessToken)}
export function createMarketProduct(accessToken:string,input:CreateMarketProductInput){return contentMutation<MarketProductDto>("/api/v1/market-products",accessToken,"POST",input)}
export function updateMarketProduct(accessToken:string,id:string,input:UpdateMarketProductInput){return contentMutation<MarketProductDto>(`/api/v1/market-products/${encodeURIComponent(id)}`,accessToken,"PATCH",input)}
export function deleteMarketProduct(accessToken:string,id:string){return contentDelete(`/api/v1/market-products/${encodeURIComponent(id)}`,accessToken)}
export function authorizeMediaUpload(accessToken:string,input:MediaUploadRequest){return contentMutation<MediaUploadAuthorizationDto>("/api/v1/media/uploads",accessToken,"POST",input)}
export function completeMediaUpload(accessToken:string,id:string){return contentMutation<{mediaId:string;status:string}>(`/api/v1/media/${encodeURIComponent(id)}/complete`,accessToken,"POST",{})}
export function mediaVariantUrl(id:string,kind:"thumbnail"|"preview"="preview"){return apiUrl(`/api/v1/media/${encodeURIComponent(id)}/variants/${kind}`).toString()}

export function getPost(id: string, accessToken?: string) {
  return contentGet<PostDto>(`/api/v1/posts/${encodeURIComponent(id)}`, accessToken);
}

export function getEvent(id: string, accessToken?: string) {
  return contentGet<EventDto>(`/api/v1/events/${encodeURIComponent(id)}`, accessToken);
}

export function getPhotographerSpot(id: string, accessToken?: string) {
  return contentGet<PhotographerSpotDto>(`/api/v1/photographer-spots/${encodeURIComponent(id)}`, accessToken);
}

export function createPost(accessToken: string, input: CreatePostInput) {
  return contentMutation<PostDto>("/api/v1/posts", accessToken, "POST", input);
}

export function updatePost(accessToken: string, id: string, input: UpdatePostInput) {
  return contentMutation<PostDto>(`/api/v1/posts/${encodeURIComponent(id)}`, accessToken, "PATCH", input);
}

export function createEvent(accessToken: string, input: CreateEventInput) {
  return contentMutation<EventDto>("/api/v1/events", accessToken, "POST", input);
}

export function updateEvent(accessToken: string, id: string, input: UpdateEventInput) {
  return contentMutation<EventDto>(`/api/v1/events/${encodeURIComponent(id)}`, accessToken, "PATCH", input);
}

export function createPhotographerSpot(accessToken: string, input: CreatePhotographerSpotInput) {
  return contentMutation<PhotographerSpotDto>("/api/v1/photographer-spots", accessToken, "POST", input);
}

export function updatePhotographerSpot(accessToken: string, id: string, input: UpdatePhotographerSpotInput) {
  return contentMutation<PhotographerSpotDto>(`/api/v1/photographer-spots/${encodeURIComponent(id)}`, accessToken, "PATCH", input);
}

export async function deleteContent(
  accessToken: string,
  domain: "posts" | "events" | "photographer-spots",
  id: string,
) {
  const response = await fetch(
    apiUrl(`/api/v1/${domain}/${encodeURIComponent(id)}`),
    {
      method: "DELETE",
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) await throwApiError(response);
}

export async function searchContent(query: string): Promise<SearchResultDto[]> {
  if (!query.trim()) return [];
  return contentGet<SearchResultDto[]>(
    `/api/v1/search?q=${encodeURIComponent(query.trim())}`,
  );
}

export async function getExploreContent(
  bbox: readonly [number, number, number, number],
  layers: readonly string[],
  signal?: AbortSignal,
  accessToken?: string,
): Promise<ExploreFeatureDto[]> {
  const query = `bbox=${bbox.join(",")}&layers=${layers.join(",")}`;
  if (typeof window !== "undefined") {
    const response = await fetch(`/api/explore?${query}`, { cache: "no-store", ...(signal ? { signal } : {}) });
    if (!response.ok) throw new ContentApiError("EXPLORE_UNAVAILABLE", response.status);
    return readData<ExploreFeatureDto[]>(response);
  }
  return contentGet<ExploreFeatureDto[]>(`/api/v1/explore?${query}`, accessToken, signal);
}

async function contentGet<T>(pathname: string, accessToken?: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(pathname), {
    cache: "no-store",
    ...(signal ? { signal } : {}),
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
  });
  if (!response.ok) await throwApiError(response);
  return readData<T>(response);
}

async function contentMutation<T>(
  pathname: string,
  accessToken: string,
  method: "POST" | "PATCH",
  input: unknown,
): Promise<T> {
  const response = await fetch(apiUrl(pathname), {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) await throwApiError(response);
  return readData<T>(response);
}

async function contentDelete(pathname:string,accessToken:string){const response=await fetch(apiUrl(pathname),{method:"DELETE",cache:"no-store",headers:{Authorization:`Bearer ${accessToken}`}});if(!response.ok)await throwApiError(response)}

function apiUrl(pathname: string): URL {
  return new URL(
    pathname,
    process.env.NEXT_PUBLIC_API_URL?.trim() ?? "http://localhost:3001",
  );
}

async function readData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data?: T };
  if (!("data" in body)) throw new ContentApiError("CONTENT_UNAVAILABLE", 503);
  return body.data as T;
}

async function throwApiError(response: Response): Promise<never> {
  const body: unknown = await response.json().catch(() => null);
  const code =
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object" &&
    "code" in body.error &&
    typeof body.error.code === "string"
      ? body.error.code
      : "CONTENT_UNAVAILABLE";
  throw new ContentApiError(code, response.status);
}
