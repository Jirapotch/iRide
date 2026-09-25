import { describe, expect, it } from "vitest";

import {
  isActivityMapOriginActive,
  mapStateHref,
  resolveBreadcrumbs,
  searchResultHref,
  communityComposeHref,
  primaryNavigation,
} from "./app-navigation-domain";

it("opens activity search results on the detail page", () => {
  expect(
    searchResultHref({
      id: "trip-1",
      kind: "event",
      title: "Mountain trip",
      subtitle: "",
      username: null,
    }),
  ).toBe("/activities/trip-1");
});

it("links a signed-in rider to the cached own-profile route", () => {
  expect(
    primaryNavigation("rider").find((item) => item.key === "profile")?.href,
  ).toBe("/profile");
});

it("returns an unauthenticated writer to the same community with a composer", () => {
  expect(communityComposeHref("motorcycle", false)).toBe(
    "/login?next=%2Fcommunity%2Fmotorcycle%2Ftalk%3Fcompose%3D1",
  );
  expect(communityComposeHref("motorcycle", true)).toBe(
    "/community/motorcycle/talk?compose=1",
  );
});

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
