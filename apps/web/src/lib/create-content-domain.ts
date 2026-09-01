import type { CommunityCategory } from "@iride/types";
import { communityTalkHref } from "./app-navigation-domain";

export const createContentTypes = ["post", "activity", "trip", "photographer-spot"] as const;
export type CreateContentType = (typeof createContentTypes)[number];

export function postDestination(category: CommunityCategory, id: string): string {
  return `${communityTalkHref(category)}?post=${encodeURIComponent(id)}`;
}
