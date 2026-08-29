import { describe, expect, it } from "vitest";

import {
  defaultMockAppState,
  parseMockAppState,
  reduceMockAppState,
  serializeMockAppState,
} from "./mock-app-state";

describe("mock app state", () => {
  it("selects products without mutating the previous state", () => {
    const initial = defaultMockAppState();
    const selected = reduceMockAppState(initial, {
      type: "toggle-product",
      productId: "helmet",
    });

    expect(selected.selectedProductIds).toEqual(["helmet"]);
    expect(initial.selectedProductIds).toEqual([]);
    expect(
      reduceMockAppState(selected, {
        type: "toggle-product",
        productId: "helmet",
      }).selectedProductIds,
    ).toEqual([]);
  });

  it("persists created market products and local UI state", () => {
    const createdProduct = {
      id: "market-created",
      name: "Touring gloves",
      price: "฿1,900",
      image: "/media/market-gear.webp",
      category: "Protection",
      vehicleKinds: ["motorcycle" as const],
    };
    const actions = [
      { type: "create-product", product: createdProduct },
      { type: "toggle-product", productId: "helmet" },
      { type: "read-notification", notificationId: "comment-1" },
    ] as const;
    const state = actions.reduce(reduceMockAppState, defaultMockAppState());
    const restored = parseMockAppState(serializeMockAppState(state));

    expect(restored).toEqual({
      version: 3,
      createdProducts: [createdProduct],
      followedPhotographerIds: [],
      selectedProductIds: ["helmet"],
      readNotificationIds: ["comment-1"],
    });
  });

  it("migrates legacy state without retaining local posts or activities", () => {
    expect(parseMockAppState(JSON.stringify({
      version: 2,
      savedTripIds: ["trans-alp"],
      joinedEventIds: ["northern-meetup"],
      createdActivities: [{ id: "legacy-activity" }],
      posts: [{ id: "legacy-post" }],
      followedPhotographerIds: ["wander-lens"],
      selectedProductIds: ["helmet"],
      readNotificationIds: ["comment-1"],
      messages: { mike: ["legacy chat"] },
    }))).toEqual({
      version: 3,
      createdProducts: [],
      followedPhotographerIds: ["wander-lens"],
      selectedProductIds: ["helmet"],
      readNotificationIds: ["comment-1"],
    });
  });

  it("falls back safely when persisted state is invalid", () => {
    expect(parseMockAppState("not-json")).toEqual(defaultMockAppState());
  });

  it("hydrates persisted state idempotently", () => {
    const persisted = {
      ...defaultMockAppState(),
      readNotificationIds: ["comment-1"],
    };

    const once = reduceMockAppState(defaultMockAppState(), {
      type: "hydrate",
      state: persisted,
    });
    const twice = reduceMockAppState(once, { type: "hydrate", state: persisted });

    expect(twice).toEqual(persisted);
  });
});
