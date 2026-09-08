import { Suspense } from "react";
import type { CommunityCategory } from "@iride/types";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";
import {
  CommunityEditRegion,
  CommunityFeedSection,
} from "./community-data-sections";
import { CommunityFeedSkeleton } from "@/features/loading/components/page-skeletons";

export async function CommunityFeedPage({
  category,
  room,
  searchParams,
}: {
  readonly category: CommunityCategory;
  readonly room: "talk" | "groups";
  readonly searchParams: Promise<{
    readonly modal?: string;
    readonly post?: string;
  }>;
}) {
  const [locale, session, query] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
    searchParams,
  ]);
  return (
    <div>
      <Suspense fallback={<CommunityFeedSkeleton locale={locale} />}>
        <CommunityFeedSection
          accessToken={session?.accessToken}
          category={category}
          locale={locale}
          room={room}
        />
      </Suspense>
      {query.modal === "edit" && query.post ? (
        <Suspense
          fallback={<div aria-busy="true" className="modal-skeleton" />}
        >
          <CommunityEditRegion
            accessToken={session?.accessToken}
            category={category}
            locale={locale}
            postId={query.post}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
