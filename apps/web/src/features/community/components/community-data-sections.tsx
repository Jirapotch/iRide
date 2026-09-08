import type { CommunityCategory, ContentAuthorDto } from "@iride/types";

import {
  communityTalkHref,
  type CommunityRoomId,
} from "@/lib/app-navigation-domain";
import { getEvents, getPost, getPosts } from "@/lib/content-api";
import { captureData } from "@/lib/data-result";
import type { Locale } from "@/lib/locale";
import { getOwnProfile } from "@/lib/profile-api";
import { CommunityScreen } from "@/features/community/components/community-screen";
import { BackendForm } from "@/features/content/components/content-editor-form";
import { EditModal } from "@/features/content/components/edit-modal";
import { SectionError } from "@/features/errors/components/section-error";

interface CommunitySectionProps {
  readonly accessToken: string | undefined;
  readonly category: CommunityCategory;
  readonly locale: Locale;
  readonly room: CommunityRoomId;
}

export async function CommunityFeedSection({
  accessToken,
  category,
  locale,
  room,
}: CommunitySectionProps) {
  const result = await captureData(async () => {
    const [posts, profile] = await Promise.all([
      getPosts(accessToken, category),
      accessToken ? getOwnProfile(accessToken) : null,
    ]);
    const viewer: ContentAuthorDto | null =
      profile?.id && profile.username && profile.displayName
        ? {
            id: profile.id,
            username: profile.username,
            displayName: profile.displayName,
          }
        : null;
    return { posts, profile, viewer };
  });

  if (result.status === "error") {
    return (
      <SectionError
        category={result.error.category}
        message={
          locale === "th"
            ? "ไม่สามารถโหลดบทสนทนาได้ในขณะนี้"
            : "Conversations could not load right now."
        }
        retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
        title={locale === "th" ? "โหลดฟีดไม่ได้" : "Feed unavailable"}
      />
    );
  }

  return (
    <CommunityScreen
      authenticated={Boolean(accessToken)}
      canWrite={result.data.profile?.canWrite ?? false}
      category={category}
      locale={locale}
      posts={result.data.posts}
      room={room}
      viewer={result.data.viewer}
    />
  );
}

export async function CommunityEditRegion({
  accessToken,
  category,
  locale,
  postId,
}: Omit<CommunitySectionProps, "room"> & { readonly postId: string }) {
  const result = await captureData(() =>
    Promise.all([getPost(postId, accessToken), getEvents(accessToken)]),
  );

  if (result.status === "error") {
    return (
      <SectionError
        category={result.error.category}
        message={
          locale === "th"
            ? "ไม่สามารถโหลดข้อมูลสำหรับแก้ไขได้"
            : "The post editor could not load."
        }
        retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
        title={locale === "th" ? "โหลดตัวแก้ไขไม่ได้" : "Editor unavailable"}
      />
    );
  }

  const [post, events] = result.data;
  if (!post.canEdit) {
    return (
      <div className="permission-toast" role="alert">
        {locale === "th"
          ? "คุณไม่มีสิทธิ์แก้ไขรายการนี้"
          : "You do not have permission to edit this item."}
      </div>
    );
  }

  return (
    <EditModal
      closeUrl={`${communityTalkHref(category)}?post=${post.id}`}
      title={locale === "th" ? "แก้ไขโพสต์" : "Edit post"}
    >
      <BackendForm
        initial={post}
        locale={locale}
        markerOptions={events.map((event) => ({
          id: event.id,
          kind: "event" as const,
          subtitle: event.locationLabel,
          title: event.title,
        }))}
        type="post"
      />
    </EditModal>
  );
}
