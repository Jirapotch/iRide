import { describe, expect, it } from "vitest";

import {
  createEventSchema,
  createPhotographerSpotSchema,
  createPostSchema,
  updateEventSchema,
} from "./index";

describe("content validation", () => {
  it("normalizes a non-empty post body", () => {
    expect(createPostSchema.parse({ body: "  Sunday meetup  " })).toEqual({
      body: "Sunday meetup",
    });
    expect(() => createPostSchema.parse({ body: "   " })).toThrow();
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
