import { getRequestLocale } from "@/lib/request-locale";
import { getEvents, getMarketProducts, getPhotographerSpots, getPosts } from "@/lib/content-api";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { CommunityScreen } from "../_components/community-screen";

export default async function CommunityPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getVerifiedWebSession().catch(() => null)]);
  const [posts, spots,events,products,viewer] = await Promise.all([getPosts(session?.accessToken).catch(() => []), getPhotographerSpots(session?.accessToken).catch(() => []),getEvents(session?.accessToken).catch(()=>[]),getMarketProducts(session?.accessToken).catch(()=>[]),session?getOwnProfile(session.accessToken).catch(()=>null):null]);
  const markerOptions=[...events.map((item)=>({kind:"event" as const,id:item.id,title:item.title,subtitle:item.locationLabel})),...spots.map((item)=>({kind:"photographerSpot" as const,id:item.id,title:item.title,subtitle:item.locationLabel}))];
  return <CommunityScreen authenticated={Boolean(session)} locale={locale} markerOptions={markerOptions} posts={posts} products={products} spots={spots} viewer={viewer?.id&&viewer.username&&viewer.displayName?{id:viewer.id,username:viewer.username,displayName:viewer.displayName}:null} />;
}
