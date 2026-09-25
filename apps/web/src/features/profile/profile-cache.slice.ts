import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { OwnProfileDto } from "@iride/types";

export const OWN_PROFILE_TTL_MS = 5 * 60_000;

export interface OwnProfileCacheState {
  readonly userId: string | null;
  readonly profile: OwnProfileDto | null;
  readonly fetchedAt: number | null;
}

const initialState: OwnProfileCacheState = {
  userId: null,
  profile: null,
  fetchedAt: null,
};

const slice = createSlice({
  name: "ownProfileCache",
  initialState,
  reducers: {
    storeOwnProfile: (
      _state,
      action: PayloadAction<{
        userId: string;
        profile: OwnProfileDto;
        fetchedAt: number;
      }>,
    ) => ({
      userId: action.payload.userId,
      profile: action.payload.profile,
      fetchedAt: action.payload.fetchedAt,
    }),
    invalidateOwnProfile: () => initialState,
  },
});

export const { storeOwnProfile, invalidateOwnProfile } = slice.actions;
export const ownProfileCacheReducer = slice.reducer;

export function selectFreshOwnProfile(
  cache: OwnProfileCacheState,
  userId: string,
  now: number,
): OwnProfileDto | null {
  if (
    cache.userId !== userId ||
    cache.profile?.id !== userId ||
    cache.fetchedAt === null
  )
    return null;
  return now - cache.fetchedAt < OWN_PROFILE_TTL_MS ? cache.profile : null;
}
