import { describe, expect, it } from "vitest";

import {
  isActivityMapOriginActive,
  mapStateHref,
  resolveBreadcrumbs,
} from "./app-navigation-domain";

describe("activity breadcrumbs", () => {
  it("describes list and detail routes", () => {
    expect(resolveBreadcrumbs("/activities", { locale: "en" })).toEqual([
      { key: "home", label: "Home", href: "/" },
      { key: "activities", label: "Activities" },
    ]);
    expect(
      resolveBreadcrumbs("/activities/trip-1", {
        locale: "en",
        entityLabel: "Mountain Trip",
      }),
    ).toEqual([
      { key: "home", label: "Home", href: "/" },
      { key: "activities", label: "Activities", href: "/activities" },
      { key: "activity", label: "Mountain Trip" },
    ]);
  });

  it("includes the activity trail on maps only when it came from detail", () => {
    expect(
      resolveBreadcrumbs("/maps", {
        locale: "en",
        from: "activities",
        entityLabel: "Mountain Trip",
        entityHref: "/activities/trip-1",
      }),
    ).toEqual([
      { key: "home", label: "Home", href: "/" },
      { key: "activities", label: "Activities", href: "/activities" },
      {
        key: "activity",
        label: "Mountain Trip",
        href: "/activities/trip-1",
      },
      { key: "maps", label: "Maps" },
    ]);
    expect(resolveBreadcrumbs("/maps", { locale: "en" })).toEqual([
      { key: "home", label: "Home", href: "/" },
      { key: "maps", label: "Maps" },
    ]);
  });
});

it("preserves the activity origin in map state links", () => {
  expect(
    mapStateHref({
      kinds: ["meeting", "event", "trip"],
      marker: "trip-1",
      from: "activities",
    }),
  ).toBe("/maps?marker=trip-1&from=activities");
});

it("keeps the activity map origin only while its marker remains selected", () => {
  expect(isActivityMapOriginActive("activities", "trip-1", "trip-1")).toBe(
    true,
  );
  expect(isActivityMapOriginActive(null, "trip-1", "trip-1")).toBe(false);
  expect(isActivityMapOriginActive("activities", "trip-1", "trip-2")).toBe(
    false,
  );
});
