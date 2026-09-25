import { Suspense } from "react";
import type { CommunityCategory } from "@iride/types";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";
import {
  CommunityEditRegion,
  CommunityFeedSection,
} from "./community-data-sections";
import { CommunityFeedSkeleton } from "@/features/loading/components/page-skeletons";
import { communityTalkHref } from "@/lib/app-navigation-domain";
import { BackendForm } from "@/features/content/components/content-editor-form";
import { EditModal } from "@/features/content/components/edit-modal";
import { getOwnProfile } from "@/lib/profile-api";

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
    readonly compose?: string;
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
      {query.compose === "1" && session ? (
        <Suspense fallback={null}>
          <CommunityComposeRegion
            accessToken={session.accessToken}
            category={category}
            locale={locale}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

async function CommunityComposeRegion({
  accessToken,
  category,
  locale,
}: {
  readonly accessToken: string;
  readonly category: CommunityCategory;
  readonly locale: "th" | "en";
}) {
  const profile = await getOwnProfile(accessToken).catch(() => null);
  if (!profile?.canWrite) return null;
  return (
    <EditModal
      closeUrl={communityTalkHref(category)}
      title={locale === "th" ? "เขียนโพสต์แรก" : "Write the first post"}
    >
      <BackendForm
        defaultCommunityCategory={category}
        initial={null}
        locale={locale}
        type="post"
      />
    </EditModal>
  );
}
