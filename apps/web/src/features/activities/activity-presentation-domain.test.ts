import type { EventDto } from "@iride/types";
import { describe, expect, it } from "vitest";

import {
  activityStatus,
  coordinateRoutePointsForEvent,
  filterAndSortActivities,
  formatActivityDate,
  projectRoutePoints,
  routePointsForEvent,
} from "./activity-presentation-domain";

const organizer = {
  id: "user-1",
  username: "rider",
  displayName: "Road Rider",
};

function event(overrides: Partial<EventDto> = {}): EventDto {
  return {
    id: "event-1",
    kind: "event",
    title: "Morning meet",
    description: null,
    locationLabel: "Bangkok",
    latitude: 13.75,
    longitude: 100.5,
    destinationLabel: null,
    destinationLatitude: null,
    destinationLongitude: null,
    startsAt: "2026-09-09T02:00:00.000Z",
    endsAt: "2026-09-09T04:00:00.000Z",
    timezone: "Asia/Bangkok",
    vehicleKinds: ["car"],
    organizer,
    canEdit: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("activityStatus", () => {
  it("uses the activity timezone to identify today", () => {
    expect(
      activityStatus(
        event({ startsAt: "2026-09-08T17:30:00.000Z", endsAt: null }),
        new Date("2026-09-08T18:00:00.000Z"),
      ),
    ).toBe("today");
  });

  it("classifies ended, future, and unscheduled activities", () => {
    const now = new Date("2026-09-08T05:00:00.000Z");
    expect(
      activityStatus(event({ endsAt: "2026-09-08T04:00:00.000Z" }), now),
    ).toBe("past");
    expect(activityStatus(event(), now)).toBe("upcoming");
    expect(activityStatus(event({ startsAt: null, endsAt: null }), now)).toBe(
      "unscheduled",
    );
  });
});

it("filters upcoming activities by kind and puts unscheduled trips last", () => {
  const now = new Date("2026-09-08T05:00:00.000Z");
  const items = [
    event({ id: "later", kind: "trip", startsAt: "2026-09-10T02:00:00.000Z" }),
    event({
      id: "meeting",
      kind: "meeting",
      startsAt: "2026-09-09T02:00:00.000Z",
    }),
    event({ id: "soon", kind: "trip", startsAt: "2026-09-09T03:00:00.000Z" }),
    event({ id: "unscheduled", kind: "trip", startsAt: null, endsAt: null }),
  ];

  expect(
    filterAndSortActivities(
      items,
      { kind: "trip", period: "upcoming" },
      now,
    ).map(({ id }) => id),
  ).toEqual(["soon", "later", "unscheduled"]);
});

it("sorts past activities from most recently finished", () => {
  const now = new Date("2026-09-12T05:00:00.000Z");
  const items = [
    event({ id: "older", startsAt: "2026-09-08T02:00:00.000Z", endsAt: null }),
    event({ id: "newer", startsAt: "2026-09-10T02:00:00.000Z", endsAt: null }),
  ];
  expect(
    filterAndSortActivities(items, { kind: "all", period: "past" }, now).map(
      ({ id }) => id,
    ),
  ).toEqual(["newer", "older"]);
});

it("orders trip route points from start through stops to destination", () => {
  const points = routePointsForEvent(
    event({
      kind: "trip",
      locationLabel: "Start",
      latitude: 13,
      longitude: 100,
      stops: [{ name: "Stop", latitude: 14, longitude: 101 }],
      destinationLabel: "Finish",
      destinationLatitude: 15,
      destinationLongitude: 102,
    }),
  );
  expect(points.map(({ role, name }) => [role, name])).toEqual([
    ["start", "Start"],
    ["stop", "Stop"],
    ["destination", "Finish"],
  ]);
});

it("projects a vertical route north-up without inventing horizontal spread", () => {
  expect(
    projectRoutePoints([
      { role: "start", name: "A", latitude: 10, longitude: 100 },
      { role: "destination", name: "B", latitude: 20, longitude: 100 },
    ]),
  ).toEqual([
    { x: 50, y: 88 },
    { x: 50, y: 12 },
  ]);
});

it("preserves timeline indexes when route points without coordinates are omitted from the map", () => {
  const points = coordinateRoutePointsForEvent(
    event({
      kind: "trip",
      locationLabel: "Start",
      latitude: null,
      longitude: null,
      stops: [{ name: "Mapped stop", latitude: 14, longitude: 101 }],
      destinationLabel: "Finish",
      destinationLatitude: 15,
      destinationLongitude: 102,
    }),
  );

  expect(points.map(({ index, point }) => [index, point.name])).toEqual([
    [1, "Mapped stop"],
    [2, "Finish"],
  ]);
});

it("uses one scale for both axes instead of stretching a shallow route", () => {
  const points = projectRoutePoints([
    { role: "start", name: "A", latitude: 0, longitude: 0 },
    { role: "destination", name: "B", latitude: 1, longitude: 10 },
  ]);

  expect(points[0]!.x).toBe(12);
  expect(points[1]!.x).toBe(88);
  expect(points[0]!.y).toBeCloseTo(53.8, 1);
  expect(points[1]!.y).toBeCloseTo(46.2, 1);
});

it("centers a single coordinate and ignores points without coordinates", () => {
  expect(
    projectRoutePoints([
      { role: "start", name: "A", latitude: null, longitude: null },
      { role: "destination", name: "B", latitude: 20, longitude: 100 },
    ]),
  ).toEqual([{ x: 50, y: 50 }]);
  expect(
    projectRoutePoints([
      { role: "start", name: "A", latitude: null, longitude: null },
    ]),
  ).toEqual([]);
});

it("clamps polar latitudes to finite Web Mercator coordinates", () => {
  const points = projectRoutePoints([
    { role: "start", name: "South", latitude: -90, longitude: 0 },
    { role: "destination", name: "North", latitude: 90, longitude: 0 },
  ]);
  expect(points).toEqual([
    { x: 50, y: 88 },
    { x: 50, y: 12 },
  ]);
});

it("formats an activity in its own timezone", () => {
  expect(
    formatActivityDate(
      event({ startsAt: "2027-10-10T02:00:00.000Z", timezone: "Asia/Bangkok" }),
      "en",
    ),
  ).toBe("Oct 10, 2027, 9:00 AM");
});
