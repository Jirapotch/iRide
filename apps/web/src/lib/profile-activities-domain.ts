import type { ExploreFeatureDto } from "@iride/types";

export function sortProfileActivities(
  items: readonly ExploreFeatureDto[],
  now = new Date(),
): ExploreFeatureDto[] {
  const boundary = now.getTime();
  const upcoming = items
    .filter(
      (item) =>
        (item.startsAt ? Date.parse(item.startsAt) : Infinity) >= boundary,
    )
    .sort(
      (left, right) =>
        (left.startsAt ? Date.parse(left.startsAt) : Infinity) -
        (right.startsAt ? Date.parse(right.startsAt) : Infinity),
    );
  const past = items
    .filter(
      (item) =>
        (item.startsAt ? Date.parse(item.startsAt) : Infinity) < boundary,
    )
    .sort(
      (left, right) =>
        (right.startsAt ? Date.parse(right.startsAt) : Infinity) -
        (left.startsAt ? Date.parse(left.startsAt) : Infinity),
    );
  return [...upcoming, ...past];
}
