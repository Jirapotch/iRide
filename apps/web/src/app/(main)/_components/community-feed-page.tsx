import { Suspense } from "react";
import type { CommunityCategory } from "@iride/types";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { Breadcrumbs } from "./breadcrumbs";
import {
  CommunityEditRegion,
  CommunityFeedSection,
} from "./community-data-sections";
import { CommunityFeedSkeleton } from "./page-skeletons";

export async function CommunityFeedPage({
  category,
  heading,
  room,
  searchParams,
}: {
  readonly category: CommunityCategory;
  readonly heading: { readonly th: string; readonly en: string };
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
  const pathname =
    room === "groups" ? "/community/groups" : `/community/${category}/talk`;
  return (
    <div className="community-page">
      <Breadcrumbs
        items={resolveBreadcrumbs(pathname, { locale })}
        locale={locale}
      />
      <header className="community-heading">
        <h1 data-route-heading tabIndex={-1}>
          {heading[locale]}
        </h1>
      </header>
      <Suspense fallback={<CommunityFeedSkeleton />}>
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
