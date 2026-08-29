import { getRequestLocale } from "@/lib/request-locale";
import { getPhotographerSpots, getPosts } from "@/lib/content-api";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { CommunityScreen } from "../_components/community-screen";

export default async function CommunityPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getVerifiedWebSession().catch(() => null)]);
  const [posts, spots] = await Promise.all([getPosts(session?.accessToken).catch(() => []), getPhotographerSpots(session?.accessToken).catch(() => [])]);
  return <CommunityScreen locale={locale} posts={posts} spots={spots} />;
}
