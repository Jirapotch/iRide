import type { SearchResultDto } from "@iride/types";
import { describe, expect, it } from "vitest";

import {
  communityRooms,
  mapStyle,
  resolveTheme,
  searchResultHref,
} from "./app-navigation-domain";

describe("application navigation domain", () => {
  it("keeps community rooms ordered and extensible", () => {
    expect(communityRooms.map((room) => room.id)).toEqual([
      "talk",
      "market",
      "photographers",
      "groups",
    ]);
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
      },
      "/community?room=talk&post=p1",
    ],
    [
      {
        id: "e1",
        kind: "event",
        title: "Trip",
        subtitle: "Bangkok",
        username: null,
      },
      "/?marker=e1",
    ],
    [
      {
        id: "s1",
        kind: "photographerSpot",
        title: "Corner",
        subtitle: "Khao Yai",
        username: "maya",
      },
      "/?marker=s1",
    ],
    [
      {
        id: "m1",
        kind: "marketProduct",
        title: "Helmet",
        subtitle: "Maya",
        username: "maya",
      },
      "/community?room=market&product=m1",
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
