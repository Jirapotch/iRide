import type { CommunityCategory } from "@iride/types";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvents, getPosts } from "@/lib/content-api";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { CommunityScreen } from "./community-screen";

export async function CommunityFeedPage({ category, heading, room, searchParams }: { readonly category: CommunityCategory; readonly heading: { readonly th: string; readonly en: string }; readonly room: "talk" | "groups"; readonly searchParams: Promise<{ readonly modal?: string; readonly post?: string }> }) {
  const [locale, session, query] = await Promise.all([getRequestLocale(), getVerifiedWebSession().catch(() => null), searchParams]);
  const accessToken = session?.accessToken;
  const [allPosts, events, viewer] = await Promise.all([
    getPosts(accessToken, category).catch(() => []),
    getEvents(accessToken).catch(() => []),
    session ? getOwnProfile(session.accessToken).catch(() => null) : null,
  ]);
  const markerOptions = events.map((item) => ({ kind: "event" as const, id: item.id, title: item.title, subtitle: item.locationLabel }));
  return <CommunityScreen authenticated={Boolean(session)} canWrite={viewer?.canWrite ?? false} category={category} editId={query.modal === "edit" ? query.post : undefined} heading={heading[locale]} locale={locale} markerOptions={markerOptions} posts={allPosts} room={room} viewer={viewer?.id && viewer.username && viewer.displayName ? { id: viewer.id, username: viewer.username, displayName: viewer.displayName } : null} />;
}
