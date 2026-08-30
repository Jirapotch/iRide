import type { ExploreFeatureDto } from "@iride/types";
import { describe, expect, it } from "vitest";

import { sortProfileActivities } from "./profile-activities-domain";

const author = { id: "u1", username: "maya", displayName: "Maya" };
function feature(id: string, startsAt: string): ExploreFeatureDto {
  return {
    id,
    kind: "event",
    title: id,
    subtitle: "Bangkok",
    latitude: 13,
    longitude: 100,
    startsAt,
    endsAt: null,
    author,
    canEdit: false,
  };
}

describe("profile activity ordering", () => {
  it("shows upcoming soonest first, followed by past newest first", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    const items = [
      feature("past-old", "2026-08-01T00:00:00.000Z"),
      feature("future-late", "2026-09-20T00:00:00.000Z"),
      feature("past-new", "2026-08-29T00:00:00.000Z"),
      feature("future-soon", "2026-09-01T00:00:00.000Z"),
    ];
    expect(sortProfileActivities(items, now).map((item) => item.id)).toEqual([
      "future-soon",
      "future-late",
      "past-new",
      "past-old",
    ]);
  });
});
