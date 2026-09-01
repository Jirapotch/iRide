import { AuthenticationError } from "@iride/auth";
import type {
  EventDto,
  ExploreFeatureDto,
  PhotographerSpotDto,
  PostDto,
  SearchResultDto,
} from "@iride/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentRequestError,
  handleContentCollection,
  handleContentItem,
  handleExplore,
  handleSearch,
  type ContentDependencies,
  type ContentRepository,
} from "./content";

const userId = "11111111-1111-4111-8111-111111111111";
const author = { id: userId, username: "road_rider", displayName: "Road Rider" };
const post: PostDto = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  body: "Sunday meetup",
  communityCategory: "motorcycle",
  author,
  canEdit: true,
  commentCount: 0,
  markerTags: [],
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

function setup() {
  const repository: ContentRepository = {
    listPosts: vi.fn().mockResolvedValue([post]),
    getPost: vi.fn().mockResolvedValue(post),
    createPost: vi.fn().mockResolvedValue(post),
    updatePost: vi.fn().mockResolvedValue(post),
    deletePost: vi.fn().mockResolvedValue(undefined),
    listEvents: vi.fn().mockResolvedValue([] as EventDto[]),
    getEvent: vi.fn().mockResolvedValue(null),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    listPhotographerSpots: vi.fn().mockResolvedValue([] as PhotographerSpotDto[]),
    getPhotographerSpot: vi.fn().mockResolvedValue(null),
    createPhotographerSpot: vi.fn(),
    updatePhotographerSpot: vi.fn(),
    deletePhotographerSpot: vi.fn(),
    explore: vi.fn().mockResolvedValue([] as ExploreFeatureDto[]),
    search: vi.fn().mockResolvedValue([] as SearchResultDto[]),
  };
  const dependencies: ContentDependencies = {
    authenticate: vi.fn().mockResolvedValue({ userId, accessTokenClaims: {} }),
    repository,
    allowedOrigins: "http://localhost:3000",
  };
  return { dependencies, repository };
}

describe("content API handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists public posts without requiring authentication", async () => {
    const { dependencies, repository } = setup();
    const response = await handleContentCollection(
      new Request("http://localhost:3001/api/v1/posts"),
      "posts",
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [post] });
    expect(repository.listPosts).toHaveBeenCalledWith(null);
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });

  it("authenticates, normalizes, and creates a post", async () => {
    const { dependencies, repository } = setup();
    const response = await handleContentCollection(
      new Request("http://localhost:3001/api/v1/posts", {
        method: "POST",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: "  Sunday meetup  ", communityCategory: "motorcycle" }),
      }),
      "posts",
      dependencies,
    );

    expect(response.status).toBe(201);
    expect(repository.createPost).toHaveBeenCalledWith(
      userId,
      "signed.jwt",
      { body: "Sunday meetup", communityCategory: "motorcycle" },
    );
  });

  it("rejects malformed create input before calling the repository", async () => {
    const { dependencies, repository } = setup();
    const response = await handleContentCollection(
      new Request("http://localhost:3001/api/v1/events", {
        method: "POST",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({ kind: "trip", title: "Missing fields" }),
      }),
      "events",
      dependencies,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "CONTENT_VALIDATION_FAILED" },
    });
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it("updates and soft-deletes only through authenticated owner operations", async () => {
    const { dependencies, repository } = setup();
    const update = await handleContentItem(
      new Request(`http://localhost:3001/api/v1/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: "Updated", communityCategory: "groups" }),
      }),
      "posts",
      post.id,
      dependencies,
    );
    const remove = await handleContentItem(
      new Request(`http://localhost:3001/api/v1/posts/${post.id}`, {
        method: "DELETE",
        headers: { authorization: "Bearer signed.jwt" },
      }),
      "posts",
      post.id,
      dependencies,
    );

    expect(update.status).toBe(200);
    expect(repository.updatePost).toHaveBeenCalledWith(
      userId,
      "signed.jwt",
      post.id,
      { body: "Updated", communityCategory: "groups" },
    );
    expect(remove.status).toBe(204);
    expect(repository.deletePost).toHaveBeenCalledWith(
      userId,
      "signed.jwt",
      post.id,
    );
  });

  it("keeps generic post, event, and photographer-spot deletes on their existing authenticated endpoints", async () => {
    const { dependencies, repository } = setup();
    const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const responses = await Promise.all(
      (["posts", "events", "photographer-spots"] as const).map((domain) =>
        handleContentItem(
          new Request(`http://localhost:3001/api/v1/${domain}/${id}`, {
            method: "DELETE",
            headers: { authorization: "Bearer signed.jwt" },
          }),
          domain,
          id,
          dependencies,
        ),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([204, 204, 204]);
    expect(repository.deletePost).toHaveBeenCalledWith(userId, "signed.jwt", id);
    expect(repository.deleteEvent).toHaveBeenCalledWith(userId, "signed.jwt", id);
    expect(repository.deletePhotographerSpot).toHaveBeenCalledWith(userId, "signed.jwt", id);
  });

  it("maps missing and forbidden records to stable errors", async () => {
    const { dependencies, repository } = setup();
    vi.mocked(repository.getPost).mockResolvedValue(null);
    const missing = await handleContentItem(
      new Request(`http://localhost:3001/api/v1/posts/${post.id}`),
      "posts",
      post.id,
      dependencies,
    );
    vi.mocked(repository.updatePost).mockRejectedValue(
      new ContentRequestError("CONTENT_FORBIDDEN", 403),
    );
    const forbidden = await handleContentItem(
      new Request(`http://localhost:3001/api/v1/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: "Updated", communityCategory: "groups" }),
      }),
      "posts",
      post.id,
      dependencies,
    );

    expect(missing.status).toBe(404);
    expect(forbidden.status).toBe(403);
  });

  it("validates explore bounds and forwards selected layers", async () => {
    const { dependencies, repository } = setup();
    const response = await handleExplore(
      new Request(
        "http://localhost:3001/api/v1/explore?bbox=100,13,101,14&layers=events,trips,photographer-spots",
      ),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.explore).toHaveBeenCalledWith(
      { west: 100, south: 13, east: 101, north: 14 },
      ["events", "trips", "photographer-spots"],
      null,
    );

    const invalid = await handleExplore(
      new Request("http://localhost:3001/api/v1/explore?bbox=101,14,100,13"),
      dependencies,
    );
    expect(invalid.status).toBe(400);
  });

  it("trims search queries and rejects empty searches", async () => {
    const { dependencies, repository } = setup();
    const response = await handleSearch(
      new Request(
        "http://localhost:3001/api/v1/search?q=%20road%20&types=profiles,events",
      ),
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(repository.search).toHaveBeenCalledWith(
      "road",
      ["profiles", "events"],
      null,
    );

    const empty = await handleSearch(
      new Request("http://localhost:3001/api/v1/search?q=%20%20"),
      dependencies,
    );
    expect(empty.status).toBe(400);
  });

  it("filters posts by a valid community category", async () => {
    const { dependencies, repository } = setup();
    const response = await handleContentCollection(
      new Request("http://localhost:3001/api/v1/posts?communityCategory=car"),
      "posts",
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(repository.listPosts).toHaveBeenCalledWith(null, "car");
  });

  it("rejects an invalid community category", async () => {
    const { dependencies, repository } = setup();
    const response = await handleContentCollection(
      new Request("http://localhost:3001/api/v1/posts?communityCategory=boat"),
      "posts",
      dependencies,
    );
    expect(response.status).toBe(400);
    expect(repository.listPosts).not.toHaveBeenCalled();
  });

  it("does not include market products in the default public search types", async () => {
    const { dependencies, repository } = setup();
    const response = await handleSearch(
      new Request("http://localhost:3001/api/v1/search?q=road"),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.search).toHaveBeenCalledWith(
      "road",
      ["profiles", "posts", "events", "photographer-spots"],
      null,
    );
  });

  it("returns authentication errors without invoking mutations", async () => {
    const { dependencies, repository } = setup();
    const unauthorized: ContentDependencies = {
      ...dependencies,
      authenticate: vi
        .fn()
        .mockRejectedValue(new AuthenticationError("AUTH_REQUIRED")),
    };
    const response = await handleContentCollection(
      new Request("http://localhost:3001/api/v1/posts", {
        method: "POST",
        body: JSON.stringify({ body: "No session" }),
      }),
      "posts",
      unauthorized,
    );

    expect(response.status).toBe(401);
    expect(repository.createPost).not.toHaveBeenCalled();
  });
});
