import {
  communityDataNeeds,
  resolveCommunityRoom,
} from "@/lib/app-navigation-domain";
import { getVerifiedWebSession } from "@/lib/auth-session";
import {
  getEvents,
  getMarketProducts,
  getPhotographerSpots,
  getPosts,
} from "@/lib/content-api";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { CommunityScreen } from "../_components/community-screen";

interface CommunityPageProps {
  readonly searchParams: Promise<{
    readonly modal?: string;
    readonly post?: string;
    readonly product?: string;
    readonly room?: string;
  }>;
}

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const [locale, session, params] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
    searchParams,
  ]);
  const room = resolveCommunityRoom(params.room);
  const needs = communityDataNeeds(room);
  const accessToken = session?.accessToken;
  const [posts, spots, events, products, viewer] = await Promise.all([
    needs.posts ? getPosts(accessToken).catch(() => []) : [],
    needs.spots ? getPhotographerSpots(accessToken).catch(() => []) : [],
    needs.events ? getEvents(accessToken).catch(() => []) : [],
    needs.products ? getMarketProducts(accessToken).catch(() => []) : [],
    session ? getOwnProfile(session.accessToken).catch(() => null) : null,
  ]);
  const markerOptions = [
    ...events.map((item) => ({
      kind: "event" as const,
      id: item.id,
      title: item.title,
      subtitle: item.locationLabel,
    })),
    ...spots.map((item) => ({
      kind: "photographerSpot" as const,
      id: item.id,
      title: item.title,
      subtitle: item.locationLabel,
    })),
  ];
  const editId =
    params.modal === "edit"
      ? room === "talk"
        ? params.post
        : room === "market"
          ? params.product
          : undefined
      : undefined;

  return (
    <CommunityScreen
      authenticated={Boolean(session)}
      editId={editId}
      locale={locale}
      markerOptions={markerOptions}
      posts={posts}
      products={products}
      room={room}
      selectedProductId={params.product}
      spots={spots}
      viewer={
        viewer?.id && viewer.username && viewer.displayName
          ? {
              id: viewer.id,
              username: viewer.username,
              displayName: viewer.displayName,
            }
          : null
      }
    />
  );
}
