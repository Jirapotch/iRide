import { expect, it } from "vitest";
import {
  selectFreshOwnProfile,
  ownProfileCacheReducer,
  storeOwnProfile,
  expireOwnProfile,
  invalidateOwnProfile,
} from "./profile-cache.slice";
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

it("same-owner expiry retains the shell draft while account invalidation clears identity", () => {
  const profile = { id: "rider-a" } as OwnProfileDto;
  const cache = ownProfileCacheReducer(
    undefined,
    storeOwnProfile({ userId: "rider-a", profile, fetchedAt: 1000 }),
  );
  const expired = ownProfileCacheReducer(cache, expireOwnProfile("rider-a"));
  expect(expired.profile).toEqual(profile);
  expect(expired.fetchedAt).toBeNull();
  expect(selectFreshOwnProfile(expired, "rider-a", 1001)).toBeNull();
  expect(ownProfileCacheReducer(cache, expireOwnProfile("rider-b"))).toBe(
    cache,
  );
  expect(
    ownProfileCacheReducer(expired, invalidateOwnProfile()).profile,
  ).toBeNull();
});
