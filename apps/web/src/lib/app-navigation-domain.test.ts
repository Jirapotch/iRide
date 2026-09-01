import type { SearchResultDto } from "@iride/types";
import { describe, expect, it } from "vitest";

import {
  communityCategoryHref,
  communityTalkHref,
  legacyCommunityHref,
  mapStyle,
  primaryNavigation,
  publicSearchResults,
  resolveTheme,
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

  it("removes market products from public search results", () => {
    expect(publicSearchResults([
      { id: "p", kind: "post", title: "Post", subtitle: "Maya", username: "maya", communityCategory: "groups" },
      { id: "m", kind: "marketProduct", title: "Helmet", subtitle: "Maya", username: "maya" },
    ]).map((item) => item.id)).toEqual(["p"]);
  });

  it.each([
    ["car", "/community/car"],
    ["motorcycle", "/community/motorcycle"],
    ["bicycle", "/community/bicycle"],
    ["photographers", "/community/photographers"],
    ["groups", "/community/groups"],
  ] as const)("routes category %s to %s", (category, expected) => {
    expect(communityCategoryHref(category)).toBe(expected);
  });

  it.each([
    ["car", "/community/car/talk"],
    ["photographers", "/community/photographers"],
    ["groups", "/community/groups"],
  ] as const)("routes talk category %s to %s", (category, expected) => {
    expect(communityTalkHref(category)).toBe(expected);
  });

  it.each([
    [undefined, "/community/groups"],
    ["talk", "/community/groups"],
    ["market", "/community/motorcycle/market"],
    ["photographers", "/community/photographers"],
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
    [
      {
        id: "s1",
        kind: "photographerSpot",
        title: "Corner",
        subtitle: "Khao Yai",
        username: "maya",
      },
      "/maps?marker=s1",
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
});
