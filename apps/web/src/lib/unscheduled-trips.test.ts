import { expect, it } from "vitest";
import { selectUpcomingEvents } from "./home-domain";
import { sortProfileActivities } from "./profile-activities-domain";
import type { EventDto, ExploreFeatureDto } from "@iride/types";

it("keeps unscheduled trips after scheduled upcoming items and before past items", () => {
  const items = [
    { id: "unscheduled", startsAt: null },
    { id: "past", startsAt: "2026-01-01T00:00:00Z" },
    { id: "upcoming", startsAt: "2026-12-01T00:00:00Z" },
  ];
  const now = new Date("2026-09-08T00:00:00Z");
  expect(
    sortProfileActivities(items as ExploreFeatureDto[], now).map(
      (item) => item.id,
    ),
  ).toEqual(["upcoming", "unscheduled", "past"]);
  expect(
    selectUpcomingEvents(items as EventDto[], now).map((item) => item.id),
  ).toEqual(["upcoming", "unscheduled"]);
});
