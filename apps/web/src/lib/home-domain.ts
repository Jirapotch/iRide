import type { CommunityCategory, EventDto, PostDto } from "@iride/types";

export type HomeLoadState<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error" };

export type HomeFeatureKind = "community" | "games" | "activities";
export type RecentJourneyKind = Exclude<HomeFeatureKind, "games">;

export interface RecentJourneyItem {
  readonly kind: RecentJourneyKind;
  readonly href: string;
  readonly visitedAt: string;
}

export type TrendingFilter = "all" | Exclude<CommunityCategory, "groups">;

const featureHrefs = {
  community: "/community/groups",
  activities: "/maps",
} as const satisfies Record<RecentJourneyKind, string>;

export function filterTrendingPosts(
  posts: readonly PostDto[],
  filter: TrendingFilter,
): PostDto[] {
  return posts
    .filter((post) => filter === "all" || post.communityCategory === filter)
    .sort(
      (left, right) =>
        right.commentCount - left.commentCount ||
        Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
}

export function selectUpcomingEvents(
  events: readonly EventDto[],
  now = new Date(),
): EventDto[] {
  const threshold = now.getTime();
  return events
    .filter((event) => Date.parse(event.startsAt) >= threshold)
    .sort(
      (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
    );
}

export function selectLatestCommunityPosts(
  posts: readonly PostDto[],
): Partial<Record<CommunityCategory, PostDto>> {
  const latest: Partial<Record<CommunityCategory, PostDto>> = {};
  for (const post of [...posts].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  )) {
    latest[post.communityCategory] ??= post;
  }
  return latest;
}

export function parseRecentJourneys(value: string | null): RecentJourneyItem[] {
  if (!value) return [];
  try {
    const candidate: unknown = JSON.parse(value);
    if (!Array.isArray(candidate)) return [];
    return candidate.filter(isRecentJourney).slice(0, 3);
  } catch {
    return [];
  }
}

export function recordRecentJourney(
  current: readonly RecentJourneyItem[],
  visit: RecentJourneyItem,
): RecentJourneyItem[] {
  if (!isRecentJourney(visit)) return [...current];
  return [
    visit,
    ...current.filter(
      (item) => isRecentJourney(item) && item.kind !== visit.kind,
    ),
  ]
    .sort((left, right) => compareVisitedAt(right.visitedAt, left.visitedAt))
    .slice(0, 3);
}

export function readHomeStorage(
  getStorage: () => Pick<Storage, "getItem">,
  key: string,
): string | null {
  try {
    return getStorage().getItem(key);
  } catch {
    return null;
  }
}

export function writeHomeStorage(
  getStorage: () => Pick<Storage, "setItem">,
  key: string,
  value: string,
): boolean {
  try {
    getStorage().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function isRecentJourney(value: unknown): value is RecentJourneyItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    isRecentJourneyKind(item.kind) &&
    item.href === featureHrefs[item.kind] &&
    typeof item.visitedAt === "string" &&
    Number.isFinite(Date.parse(item.visitedAt))
  );
}

function isRecentJourneyKind(value: unknown): value is RecentJourneyKind {
  return value === "community" || value === "activities";
}

function compareVisitedAt(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime;
  }
  return left.localeCompare(right, undefined, { numeric: true });
}
