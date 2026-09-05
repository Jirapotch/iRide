import { describe, expect, it } from "vitest";

import {
  defaultMockAppState,
  parseMockAppState,
  reduceMockAppState,
  serializeMockAppState,
} from "./mock-app-state";

describe("mock app state", () => {
  it("persists remaining local UI state", () => {
    const actions = [
      { type: "read-notification", notificationId: "comment-1" },
    ] as const;
    const state = actions.reduce(reduceMockAppState, defaultMockAppState());
    expect(parseMockAppState(serializeMockAppState(state))).toEqual({
      version: 5,
      readNotificationIds: ["comment-1"],
    });
  });

  it("migrates legacy state without retaining local content or market state", () => {
    expect(parseMockAppState(JSON.stringify({
      version: 3,
      createdProducts: [{ id: "legacy", name: "Helmet", price: "฿1" }],
      selectedProductIds: ["helmet"],
      followedPhotographerIds: ["wander-lens"],
      readNotificationIds: ["comment-1"],
    }))).toEqual({
      version: 5,
      readNotificationIds: ["comment-1"],
    });
  });

  it("falls back safely when persisted state is invalid", () => {
    expect(parseMockAppState("not-json")).toEqual(defaultMockAppState());
  });

  it("hydrates persisted state idempotently", () => {
    const persisted = { ...defaultMockAppState(), readNotificationIds: ["comment-1"] };
    const once = reduceMockAppState(defaultMockAppState(), { type: "hydrate", state: persisted });
    expect(reduceMockAppState(once, { type: "hydrate", state: persisted })).toEqual(persisted);
  });
});
