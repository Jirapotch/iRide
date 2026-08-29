import { describe, expect, it } from "vitest";

import {
  createCommentSchema,
  createEventSchema,
  createMarketProductSchema,
  createPhotographerSpotSchema,
  createPostSchema,
  createVehicleSchema,
  mediaUploadRequestSchema,
  updateEventSchema,
} from "./index";

describe("content validation", () => {
  it("normalizes a non-empty post body", () => {
    expect(createPostSchema.parse({ body: "  Sunday meetup  " })).toEqual({
      body: "Sunday meetup",
    });
    expect(() => createPostSchema.parse({ body: "   " })).toThrow();
  });

  it("accepts up to five marker tags and rejects duplicates", () => {
    const tag = { kind: "event" as const, id: "10000000-0000-4000-8000-000000000001" };
    expect(createPostSchema.parse({ body: "Meet here", markerTags: [tag] })).toEqual({
      body: "Meet here",
      markerTags: [tag],
    });
    expect(() => createPostSchema.parse({ body: "Meet here", markerTags: [tag, tag] })).toThrow();
    expect(() => createPostSchema.parse({
      body: "Too many",
      markerTags: Array.from({ length: 6 }, (_, index) => ({
        kind: "event" as const,
        id: `10000000-0000-4000-8000-00000000000${index}`,
      })),
    })).toThrow();
  });

  it("validates comments and one-level reply identifiers", () => {
    expect(createCommentSchema.parse({ body: "  Great route  ", parentId: null })).toEqual({
      body: "Great route",
      parentId: null,
    });
    expect(() => createCommentSchema.parse({ body: "", parentId: null })).toThrow();
  });

  it("validates vehicle and market inputs", () => {
    expect(createVehicleSchema.parse({
      kind: "motorcycle",
      brand: "Honda",
      model: "Africa Twin",
      year: 2025,
      nickname: "Atlas",
      description: null,
      visibility: "public",
      mediaIds: [],
    })).toMatchObject({ brand: "Honda", visibility: "public" });
    expect(createMarketProductSchema.parse({
      name: "Touring helmet",
      priceSatang: 1450000,
      category: "Protection",
      vehicleKinds: ["motorcycle"],
      coverMediaId: null,
    })).toMatchObject({ currency: "THB", priceSatang: 1450000 });
  });

  it("restricts media uploads to supported images under 10 MB", () => {
    expect(mediaUploadRequestSchema.parse({
      filename: "avatar.webp",
      mimeType: "image/webp",
      bytes: 1024,
      purpose: "avatar",
    })).toMatchObject({ purpose: "avatar" });
    expect(() => mediaUploadRequestSchema.parse({
      filename: "avatar.gif",
      mimeType: "image/gif",
      bytes: 1024,
      purpose: "avatar",
    })).toThrow();
    expect(() => mediaUploadRequestSchema.parse({
      filename: "cover.jpg",
      mimeType: "image/jpeg",
      bytes: 10 * 1024 * 1024 + 1,
      purpose: "cover",
    })).toThrow();
  });

  it("requires destination details for trips", () => {
    const common = {
      kind: "trip" as const,
      title: "Khao Yai sunrise",
      description: "Leave before dawn",
      locationLabel: "Bangkok",
      latitude: 13.7563,
      longitude: 100.5018,
      startsAt: "2026-09-01T22:45:00.000Z",
      endsAt: "2026-09-02T06:00:00.000Z",
      timezone: "Asia/Bangkok",
      vehicleKinds: ["car" as const],
    };

    expect(() => createEventSchema.parse(common)).toThrow();
    expect(
      createEventSchema.parse({
        ...common,
        destinationLabel: "Khao Yai",
        destinationLatitude: 14.439,
        destinationLongitude: 101.372,
      }),
    ).toMatchObject({ kind: "trip", destinationLabel: "Khao Yai" });
  });

  it("rejects an event that ends before it starts", () => {
    expect(() =>
      createEventSchema.parse({
        kind: "event",
        title: "Urban Motion",
        description: null,
        locationLabel: "Bangkok",
        latitude: 13.73,
        longitude: 100.54,
        startsAt: "2026-09-02T10:00:00.000Z",
        endsAt: "2026-09-02T09:00:00.000Z",
        timezone: "Asia/Bangkok",
        vehicleKinds: ["motorcycle"],
      }),
    ).toThrow();
  });

  it("requires update payloads to contain at least one field", () => {
    expect(() => updateEventSchema.parse({})).toThrow();
    expect(updateEventSchema.parse({ title: "Updated title" })).toEqual({
      title: "Updated title",
    });
  });

  it("validates a scheduled photographer spot without realtime claims", () => {
    expect(
      createPhotographerSpotSchema.parse({
        title: "Corner 7 morning session",
        description: "Published shooting schedule",
        locationLabel: "Khao Yai",
        latitude: 14.439,
        longitude: 101.372,
        startsAt: "2026-09-05T00:00:00.000Z",
        endsAt: "2026-09-05T04:00:00.000Z",
        timezone: "Asia/Bangkok",
      }),
    ).toMatchObject({ title: "Corner 7 morning session" });
  });
});
