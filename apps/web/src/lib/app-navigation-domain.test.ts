import type { SearchResultDto } from "@iride/types";
import { describe, expect, it } from "vitest";

import {
  adminUserDetailHref,
  adminUsersHref,
  communityCategoryHref,
  communityTalkHref,
  legacyCommunityHref,
  mapStateHref,
  mapStyle,
  parseMapKinds,
  primaryNavigation,
  publicSearchResults,
  resolveBreadcrumbs,
  resolveTheme,
  searchHref,
  searchResultHref,
} from "./app-navigation-domain";

describe("application navigation domain", () => {
  it("keeps primary navigation in the requested order", () => {
    expect(primaryNavigation("maya").map((item) => item.key)).toEqual([
      "home",
      "maps",
      "create",
      "search",
      "profile",
    ]);
  });

  it("keeps remaining public search results", () => {
    expect(
      publicSearchResults([
        {
          id: "p",
          kind: "post",
          title: "Post",
          subtitle: "Maya",
          username: "maya",
          communityCategory: "groups",
        },
      ]).map((item) => item.id),
    ).toEqual(["p"]);
  });

  it.each([
    ["car", "/community/car"],
    ["motorcycle", "/community/motorcycle"],
    ["bicycle", "/community/bicycle"],
    ["groups", "/community/groups"],
  ] as const)("routes category %s to %s", (category, expected) => {
    expect(communityCategoryHref(category)).toBe(expected);
  });

  it.each([
    ["car", "/community/car/talk"],
    ["groups", "/community/groups"],
  ] as const)("routes talk category %s to %s", (category, expected) => {
    expect(communityTalkHref(category)).toBe(expected);
  });

  it.each([
    [undefined, "/community/groups"],
    ["talk", "/community/groups"],
    ["market", "/"],
    ["photographers", "/"],
    ["groups", "/community/groups"],
    ["unknown", "/community/groups"],
  ] as const)("redirects legacy room %s to %s", (room, expected) => {
    expect(legacyCommunityHref(room)).toBe(expected);
  });

  it("preserves legacy post and edit selections", () => {
    expect(legacyCommunityHref("talk", { post: "p1", modal: "edit" })).toBe(
      "/community/groups?post=p1&modal=edit",
    );
  });

  it.each([
    [
      {
        id: "u1",
        kind: "profile",
        title: "Maya",
        subtitle: "@maya",
        username: "maya",
      },
      "/users/maya",
    ],
    [
      {
        id: "p1",
        kind: "post",
        title: "Hello",
        subtitle: "Maya",
        username: "maya",
        communityCategory: "car",
      },
      "/community/car/talk?post=p1",
    ],
    [
      {
        id: "e1",
        kind: "event",
        title: "Trip",
        subtitle: "Bangkok",
        username: null,
      },
      "/maps?marker=e1",
    ],
  ] satisfies [SearchResultDto, string][])(
    "routes %s to %s",
    (result, href) => {
      expect(searchResultHref(result)).toBe(href);
    },
  );

  it("uses a stored theme and defaults new users to Mint Light", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme("invalid", false)).toBe("light");
  });

  it("uses MapTiler with a key and inline OSM raster without one", () => {
    expect(mapStyle("public-key")).toBe(
      "https://api.maptiler.com/maps/streets-v2/style.json?key=public-key",
    );
    expect(mapStyle(undefined)).toMatchObject({
      version: 8,
      sources: { osm: { type: "raster" } },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    });
  });

  it("resolves a localized nested community hierarchy", () => {
    expect(resolveBreadcrumbs("/community/car/talk", { locale: "en" })).toEqual(
      [
        { key: "home", label: "Home", href: "/" },
        { key: "community-car", label: "Cars", href: "/community/car" },
        { key: "community-talk", label: "Talk" },
      ],
    );
  });

  it("keeps a context-preserving admin parent href", () => {
    expect(
      resolveBreadcrumbs("/settings/users/user-1", {
        locale: "th",
        entityLabel: "สมชาย",
        parentHref: "/settings/users?q=som&page=2",
      }),
    ).toEqual([
      { key: "home", label: "หน้าหลัก", href: "/" },
      {
        key: "admin-users",
        label: "จัดการผู้ใช้",
        href: "/settings/users?q=som&page=2",
      },
      { key: "admin-user", label: "สมชาย" },
    ]);
  });

  it("uses the active profile tab as the final item", () => {
    expect(
      resolveBreadcrumbs("/users/maya", {
        locale: "en",
        entityLabel: "Maya",
        tab: "garage",
      }),
    ).toEqual([
      { key: "home", label: "Home", href: "/" },
      { key: "profile", label: "Maya", href: "/users/maya" },
      { key: "profile-garage", label: "Garage" },
    ]);
  });

  it("keeps malformed profile path segments safe", () => {
    expect(
      resolveBreadcrumbs("/users/%", {
        locale: "en",
        entityLabel: "Profile",
        tab: "garage",
      }),
    ).toContainEqual({ key: "profile", label: "Profile", href: "/users/%25" });
  });

  it("serializes restorable search and admin state", () => {
    expect(searchHref("  maya  ")).toBe("/search?q=maya");
    expect(searchHref(" ")).toBe("/search");
    expect(adminUsersHref({ q: "locked rider", page: 2 })).toBe(
      "/settings/users?q=locked+rider&page=2",
    );
    expect(adminUserDetailHref("u/1", "/settings/users?q=locked&page=2")).toBe(
      "/settings/users/u%2F1?from=%2Fsettings%2Fusers%3Fq%3Dlocked%26page%3D2",
    );
  });

  it("round-trips canonical map filters and selection", () => {
    expect(parseMapKinds("trip,meeting,unknown")).toEqual(["meeting", "trip"]);
    expect(parseMapKinds(null)).toEqual(["meeting", "event", "trip"]);
    expect(parseMapKinds("")).toEqual([]);
    expect(mapStateHref({ kinds: [] })).toBe("/maps?layers=");
    expect(
      mapStateHref({ kinds: ["trip", "meeting"], marker: "event-1" }),
    ).toBe("/maps?layers=meeting%2Ctrip&marker=event-1");
  });
});
