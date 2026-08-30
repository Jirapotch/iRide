import type { ExploreFeatureDto } from "@iride/types";

export function sortProfileActivities(
  items: readonly ExploreFeatureDto[],
  now = new Date(),
): ExploreFeatureDto[] {
  const boundary = now.getTime();
  const upcoming = items
    .filter((item) => new Date(item.startsAt).getTime() >= boundary)
    .sort(
      (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
    );
  const past = items
    .filter((item) => new Date(item.startsAt).getTime() < boundary)
    .sort(
      (left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt),
    );
  return [...upcoming, ...past];
}
