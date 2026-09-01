import { describe, expect, it } from "vitest";

import {
  createActivity,
  filterActivities,
  searchApp,
  validateCreateActivity,
} from "./activity-domain";
import type { ActivityItem } from "./activity-domain";

const activities: ActivityItem[] = [
  { id: "riverside-meet", kind: "meeting", title: "Riverside Vehicle Meetup", coordinate: [100.493, 13.768], locationLabel: "Rama VIII Bridge", startsAt: "2026-08-29T18:30", summary: "All vehicles welcome", host: "Bangkok Motion Club", participantCount: 24, vehicleKinds: ["car", "motorcycle", "bicycle"] },
  { id: "khao-yai-drive", kind: "trip", title: "Bangkok to Khao Yai", coordinate: [100.72, 14.132], locationLabel: "Bangkok departure", destinationLabel: "Khao Yai", startsAt: "2026-08-31T05:45", summary: "An early mixed-vehicle trip", host: "Weekend Explorers", participantCount: 18, vehicleKinds: ["car", "motorcycle"] },
  { id: "maya-photo-session", kind: "photographerSpot", title: "Maya roadside photo session", coordinate: [100.624, 13.806], locationLabel: "Nong Bon curve", startsAt: "2026-08-29T07:00", summary: "Maya Velocity is photographing today", host: "Maya Velocity", participantCount: 12, vehicleKinds: ["car", "motorcycle", "bicycle"] },
];
const products = [
  { id: "helmet", name: "Adventure Helmet", category: "Protection" },
];
const searchProfiles = [
  { id: "maya-velocity", name: "Maya Velocity", handle: "@maya.velocity", role: "Photographer" },
];

describe("activity domain", () => {
  it("filters the shared activity read model by kind", () => {
    expect(filterActivities(activities, "trip").map((item) => item.id)).toEqual([
      "khao-yai-drive",
    ]);
    expect(filterActivities(activities, "all")).toHaveLength(activities.length);
  });

  it("validates common fields and trip destination independently", () => {
    expect(
      validateCreateActivity({
        kind: "trip",
        title: "  ",
        locationLabel: "Bangkok",
        startsAt: "2026-09-01T06:00",
        destinationLabel: "",
        summary: "Morning drive",
        vehicleKinds: ["car"],
      }),
    ).toEqual({ title: "Title is required", destinationLabel: "Destination is required" });
  });

  it("creates a normalized activity at the Bangkok fallback coordinate", () => {
    const created = createActivity(
      {
        kind: "meeting",
        title: "  Riverside meetup  ",
        locationLabel: "Rama VIII Bridge",
        startsAt: "2026-09-01T18:30",
        summary: "  All vehicles welcome  ",
        vehicleKinds: ["car", "motorcycle", "bicycle"],
      },
      "activity-fixed",
    );

    expect(created).toMatchObject({
      id: "activity-fixed",
      kind: "meeting",
      title: "Riverside meetup",
      summary: "All vehicles welcome",
      coordinate: [100.5018, 13.7563],
      createdByViewer: true,
    });
  });

  it.each(["meeting", "event", "trip"] as const)(
    "accepts a complete %s activity",
    (kind) => {
      expect(
        validateCreateActivity({
          kind,
          title: "Weekend motion",
          locationLabel: "Bangkok",
          startsAt: "2026-09-02T09:00",
          summary: "Open to the community",
          vehicleKinds: ["bicycle"],
          ...(kind === "trip" ? { destinationLabel: "Khao Yai" } : {}),
        }),
      ).toEqual({});
    },
  );

  it("groups global search results across profiles, activities, and products", () => {
    expect(searchApp("maya", activities, products, searchProfiles)).toEqual({
      profiles: [expect.objectContaining({ id: "maya-velocity" })],
      activities: [expect.objectContaining({ id: "maya-photo-session" })],
      products: [],
    });
  });
});
