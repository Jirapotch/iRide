import { expect, it } from "vitest";
import { selectFreshOwnProfile } from "./profile-cache.slice";
import type { OwnProfileDto } from "@iride/types";

it("uses a fresh own-profile snapshot only for the matching account", () => {
  const cache = {
    userId: "rider-a",
    fetchedAt: 1000,
    profile: { id: "rider-a" } as OwnProfileDto,
  };
  expect(selectFreshOwnProfile(cache, "rider-a", 1000 + 4 * 60_000)?.id).toBe(
    "rider-a",
  );
  expect(selectFreshOwnProfile(cache, "rider-b", 1000 + 1000)).toBeNull();
  expect(
    selectFreshOwnProfile(cache, "rider-a", 1000 + 5 * 60_000 + 1),
  ).toBeNull();
});
