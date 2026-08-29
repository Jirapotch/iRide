import { getRequestLocale } from "@/lib/request-locale";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvents, getPhotographerSpots } from "@/lib/content-api";
import { legacyEditRedirect } from "@/lib/edit-modal-domain";
import { CreateContentScreen } from "../_components/create-content-screen";

const createTypes = ["post", "activity", "trip", "photographer-spot", "market"] as const;
type CreateType = (typeof createTypes)[number];

export default async function CreatePage({ searchParams }: { readonly searchParams: Promise<{ type?: string; edit?: string }> }) {
  const session = await getVerifiedWebSession();
  const params = await searchParams;
  const type: CreateType = createTypes.includes(params.type as CreateType) ? params.type as CreateType : "post";
  if (!session) redirect(`/login?next=${encodeURIComponent(`/create?type=${type}`)}`);
  if(params.edit)redirect(legacyEditRedirect(type,params.edit));
  const [events,spots]=await Promise.all([getEvents(session.accessToken).catch(()=>[]),getPhotographerSpots(session.accessToken).catch(()=>[])]);
  const markerOptions=[...events.map((item)=>({kind:"event" as const,id:item.id,title:item.title,subtitle:item.locationLabel})),...spots.map((item)=>({kind:"photographerSpot" as const,id:item.id,title:item.title,subtitle:item.locationLabel}))];
  return <CreateContentScreen initial={null} locale={await getRequestLocale()} markerOptions={markerOptions} type={type} />;
}
