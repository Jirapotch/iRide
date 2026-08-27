import { describe, expect, it } from "vitest";

import {
  defaultMockAppState,
  parseMockAppState,
  reduceMockAppState,
  serializeMockAppState,
} from "./mock-app-state";

describe("mock app state", () => {
  it("joins activities without mutating the previous state", () => {
    const initial = defaultMockAppState();
    const joined = reduceMockAppState(initial, {
      type: "toggle-activity",
      activityId: "khao-yai-drive",
    });

    expect(joined.joinedActivityIds).toEqual(["khao-yai-drive"]);
    expect(initial.joinedActivityIds).toEqual([]);
    expect(
      reduceMockAppState(joined, {
        type: "toggle-activity",
        activityId: "khao-yai-drive",
      }).joinedActivityIds,
    ).toEqual([]);
  });

  it("persists created activities, posts, products, notifications, and view mode", () => {
    const createdActivity = {
      id: "created-meeting",
      kind: "meeting" as const,
      title: "City meetup",
      coordinate: [100.5018, 13.7563] as [number, number],
      locationLabel: "Bangkok",
      startsAt: "2026-09-01T18:00",
      summary: "Meet the community",
      host: "You",
      participantCount: 1,
      vehicleKinds: ["car" as const],
      createdByViewer: true,
    };
    const actions = [
      { type: "create-activity", activity: createdActivity },
      { type: "create-post", post: { id: "post-1", body: "See you there", createdAt: "now" } },
      { type: "toggle-product", productId: "helmet" },
      { type: "read-notification", notificationId: "comment-1" },
      { type: "set-view-mode", viewMode: "list" },
    ] as const;
    const state = actions.reduce(reduceMockAppState, defaultMockAppState());
    const restored = parseMockAppState(serializeMockAppState(state));

    expect(restored).toEqual({
      version: 2,
      joinedActivityIds: [],
      createdActivities: [createdActivity],
      posts: [{ id: "post-1", body: "See you there", createdAt: "now" }],
      followedPhotographerIds: [],
      selectedProductIds: ["helmet"],
      readNotificationIds: ["comment-1"],
      viewMode: "list",
    });
  });

  it("migrates version one state without retaining chat data", () => {
    expect(parseMockAppState(JSON.stringify({
      version: 1,
      savedTripIds: ["trans-alp"],
      joinedEventIds: ["northern-meetup"],
      followedPhotographerIds: ["wander-lens"],
      selectedProductIds: ["helmet"],
      readNotificationIds: ["comment-1"],
      messages: { mike: ["legacy chat"] },
    }))).toEqual({
      version: 2,
      joinedActivityIds: ["trans-alp", "northern-meetup"],
      createdActivities: [],
      posts: [],
      followedPhotographerIds: ["wander-lens"],
      selectedProductIds: ["helmet"],
      readNotificationIds: ["comment-1"],
      viewMode: "map",
    });
  });

  it("falls back safely when persisted state is invalid", () => {
    expect(parseMockAppState("not-json")).toEqual(defaultMockAppState());
  });

  it("hydrates persisted state idempotently", () => {
    const persisted = {
      ...defaultMockAppState(),
      joinedActivityIds: ["khao-yai-drive"],
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
