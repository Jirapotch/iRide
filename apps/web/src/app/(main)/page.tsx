import { getRequestLocale } from "@/lib/request-locale";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvent,getPhotographerSpot } from "@/lib/content-api";
import { ActivityHub } from "./_components/activity-hub";

export default async function HomePage({searchParams}:{readonly searchParams:Promise<{marker?:string;modal?:string}>}) {
  const [locale,params,session]=await Promise.all([getRequestLocale(),searchParams,getVerifiedWebSession().catch(()=>null)]);
  let initialEdit=null;
  if(params.modal==="edit"&&params.marker&&session){initialEdit=await getEvent(params.marker,session.accessToken).catch(()=>getPhotographerSpot(params.marker!,session.accessToken).catch(()=>null));if(initialEdit&&!initialEdit.canEdit)initialEdit=null}
  return <ActivityHub initialEdit={initialEdit} locale={locale} />;
}
