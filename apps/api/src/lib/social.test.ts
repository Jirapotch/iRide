import { describe, expect, it, vi } from "vitest";

import type {
  CommentDto,
  ExploreFeatureDto,
  MarketProductDto,
  VehicleDto,
} from "@iride/types";

import {
  handleCommentItem,
  handleCommentsCollection,
  handleGarage,
  handleProfileActivities,
  handleMarketCollection,
  handleMarketItem,
  handleVehicleCollection,
  handleVehicleItem,
  type SocialDependencies,
} from "./social";

const userId = "10000000-0000-4000-8000-000000000001";
const postId = "20000000-0000-4000-8000-000000000001";
const itemId = "30000000-0000-4000-8000-000000000001";
const author = {
  id: userId,
  username: "road_rider",
  displayName: "Road Rider",
};
const comment: CommentDto = {
  id: itemId,
  postId,
  body: "Great route",
  author,
  parentId: null,
  replyTo: null,
  deleted: false,
  canEdit: true,
  createdAt: "2026-08-30T00:00:00Z",
  updatedAt: "2026-08-30T00:00:00Z",
};
const vehicle: VehicleDto = {
  id: itemId,
  owner: author,
  kind: "motorcycle",
  brand: "Honda",
  model: "Africa Twin",
  year: 2025,
  nickname: "Atlas",
  description: null,
  visibility: "public",
  mediaIds: [],
  canEdit: true,
  createdAt: "2026-08-30T00:00:00Z",
  updatedAt: "2026-08-30T00:00:00Z",
};
const product: MarketProductDto = {
  id: itemId,
  owner: author,
  name: "Helmet",
  priceSatang: 1450000,
  currency: "THB",
  category: "Protection",
  vehicleKinds: ["motorcycle"],
  coverMediaId: null,
  canEdit: true,
  createdAt: "2026-08-30T00:00:00Z",
  updatedAt: "2026-08-30T00:00:00Z",
};
const activity: ExploreFeatureDto = {
  id: itemId,
  kind: "trip",
  title: "Khao Yai",
  subtitle: "Pak Chong",
  latitude: 14.43,
  longitude: 101.37,
  startsAt: "2026-09-01T00:00:00Z",
  endsAt: null,
  author,
  canEdit: true,
};

function setup(): SocialDependencies {
  return {
    authenticate: vi
      .fn()
      .mockResolvedValue({ userId, accessToken: "signed.jwt" }),
    repository: {
      listComments: vi.fn().mockResolvedValue([comment]),
      createComment: vi.fn().mockResolvedValue(comment),
      updateComment: vi.fn().mockResolvedValue(comment),
      deleteComment: vi.fn().mockResolvedValue(undefined),
      listGarage: vi.fn().mockResolvedValue([vehicle]),
      listProfileActivities: vi.fn().mockResolvedValue([activity]),
      getVehicle: vi.fn().mockResolvedValue(vehicle),
      createVehicle: vi.fn().mockResolvedValue(vehicle),
      updateVehicle: vi.fn().mockResolvedValue(vehicle),
      deleteVehicle: vi.fn().mockResolvedValue(undefined),
      listMarketProducts: vi.fn().mockResolvedValue([product]),
      getMarketProduct: vi.fn().mockResolvedValue(product),
      createMarketProduct: vi.fn().mockResolvedValue(product),
      updateMarketProduct: vi.fn().mockResolvedValue(product),
      deleteMarketProduct: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const authHeaders = {
  authorization: "Bearer signed.jwt",
  "content-type": "application/json",
};

describe("social API handlers", () => {
  it("creates a validated comment as the authenticated user", async () => {
    const dependencies = setup();
    const response = await handleCommentsCollection(
      new Request(`https://api.test/posts/${postId}/comments`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ body: " Great route ", parentId: null }),
      }),
      postId,
      dependencies,
    );
    expect(response.status).toBe(201);
    expect(dependencies.repository.createComment).toHaveBeenCalledWith(
      userId,
      "signed.jwt",
      postId,
      { body: "Great route", parentId: null },
    );
  });

  it("rejects an invalid comment before calling the repository", async () => {
    const dependencies = setup();
    const response = await handleCommentsCollection(
      new Request(`https://api.test/posts/${postId}/comments`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ body: "", parentId: null }),
      }),
      postId,
      dependencies,
    );
    expect(response.status).toBe(400);
    expect(dependencies.repository.createComment).not.toHaveBeenCalled();
  });

  it("delegates owner comment update and delete with the bearer token", async () => {
    const dependencies = setup();
    const patch = await handleCommentItem(
      new Request(`https://api.test/comments/${itemId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ body: "Updated" }),
      }),
      itemId,
      dependencies,
    );
    expect(patch.status).toBe(200);
    const removed = await handleCommentItem(
      new Request(`https://api.test/comments/${itemId}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
      itemId,
      dependencies,
    );
    expect(removed.status).toBe(204);
  });

  it("lists a public garage and validates vehicle creation", async () => {
    const dependencies = setup();
    expect(
      (
        await handleGarage(
          new Request("https://api.test/users/road_rider/garage"),
          "road_rider",
          dependencies,
        )
      ).status,
    ).toBe(200);
    const response = await handleVehicleCollection(
      new Request("https://api.test/vehicles", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          kind: "motorcycle",
          brand: "Honda",
          model: "Africa Twin",
          year: 2025,
          nickname: "Atlas",
          description: null,
          visibility: "public",
          mediaIds: [],
        }),
      }),
      dependencies,
    );
    expect(response.status).toBe(201);
    expect(dependencies.repository.createVehicle).toHaveBeenCalledWith(
      userId,
      "signed.jwt",
      expect.objectContaining({ brand: "Honda" }),
    );
  });

  it("lists all visible marker activities for a public profile", async () => {
    const dependencies = setup();
    const response = await handleProfileActivities(
      new Request("https://api.test/users/road_rider/activities"),
      "road_rider",
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [activity] });
    expect(dependencies.repository.listProfileActivities).toHaveBeenCalledWith(
      "road_rider",
      null,
    );
  });

  it("updates and permanently deletes a vehicle through authenticated operations", async () => {
    const dependencies = setup();
    expect(
      (
        await handleVehicleItem(
          new Request(`https://api.test/vehicles/${itemId}`, {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify({ nickname: "New Atlas" }),
          }),
          itemId,
          dependencies,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleVehicleItem(
          new Request(`https://api.test/vehicles/${itemId}`, {
            method: "DELETE",
            headers: authHeaders,
          }),
          itemId,
          dependencies,
        )
      ).status,
    ).toBe(204);
    expect(dependencies.repository.deleteVehicle).toHaveBeenCalledWith(
      userId,
      "signed.jwt",
      itemId,
    );
  });

  it("provides authenticated market CRUD", async () => {
    const dependencies = setup();
    expect(
      (
        await handleMarketCollection(
          new Request("https://api.test/market-products"),
          dependencies,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleMarketCollection(
          new Request("https://api.test/market-products", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              name: "Helmet",
              priceSatang: 1450000,
              category: "Protection",
              vehicleKinds: ["motorcycle"],
              coverMediaId: null,
            }),
          }),
          dependencies,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await handleMarketItem(
          new Request(`https://api.test/market-products/${itemId}`, {
            method: "GET",
          }),
          itemId,
          dependencies,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleMarketItem(
          new Request(`https://api.test/market-products/${itemId}`, {
            method: "DELETE",
            headers: authHeaders,
          }),
          itemId,
          dependencies,
        )
      ).status,
    ).toBe(204);
  });
});
