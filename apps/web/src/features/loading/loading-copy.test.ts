import { describe, expect, it } from "vitest";

import { getLoadingLabel } from "./loading-copy";

describe("getLoadingLabel", () => {
  it("returns a Thai label for the map surface", () => {
    expect(getLoadingLabel("th", "map")).toBe("กำลังโหลดแผนที่และกิจกรรม");
  });

  it("returns an English label for the games catalog", () => {
    expect(getLoadingLabel("en", "games")).toBe("Loading games");
  });

  it("localizes every supported loading surface", () => {
    for (const surface of [
      "community",
      "profile",
      "admin-list",
      "admin-detail",
      "create",
      "map",
      "games",
      "game",
      "shell",
    ] as const) {
      expect(getLoadingLabel("th", surface)).not.toBe(
        getLoadingLabel("en", surface),
      );
    }
  });
});
