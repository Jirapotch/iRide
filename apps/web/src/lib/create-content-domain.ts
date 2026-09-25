import type { CommunityCategory } from "@iride/types";
import { communityTalkHref } from "./app-navigation-domain";

export const createContentTypes = ["post", "activity", "trip"] as const;
export type CreateContentType = (typeof createContentTypes)[number];

export function postDestination(
  category: CommunityCategory,
  id: string,
  groupSlug?: string | null,
): string {
  const href =
    category === "groups" && groupSlug
      ? `/community/groups/${encodeURIComponent(groupSlug)}`
      : communityTalkHref(category);
  return `${href}?post=${encodeURIComponent(id)}`;
}
