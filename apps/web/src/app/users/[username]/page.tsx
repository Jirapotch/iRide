import { notFound } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile, getPublicProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { getGarage } from "@/lib/content-api";
import { AppShell } from "../../(main)/_components/app-shell";
import { UserProfileScreen } from "./user-profile-screen";

export default async function UserProfilePage({ params,searchParams }: { readonly params:Promise<{username:string}>;readonly searchParams:Promise<{tab?:string;vehicle?:string;modal?:string}> }) {
  const [{username},query,locale,session]=await Promise.all([params,searchParams,getRequestLocale(),getVerifiedWebSession()]);
  const [profile,ownProfile,vehicles]=await Promise.all([
    getPublicProfile(username,session?.accessToken),
    session?getOwnProfile(session.accessToken).catch(()=>null):Promise.resolve(null),
    getGarage(username,session?.accessToken).catch(()=>[]),
  ]);
  if(!profile)notFound();
  const ownerProfile=ownProfile?.username===profile.username?ownProfile:null;
  return <AppShell authenticated={Boolean(session)} locale={locale} username={ownProfile?.username??null}><UserProfileScreen locale={locale} ownerProfile={ownerProfile} profile={profile} vehicles={vehicles} {...(query.tab?{initialTab:query.tab}:{})} {...(query.modal?{modal:query.modal}:{})} {...(query.vehicle?{selectedVehicleId:query.vehicle}:{})}/></AppShell>;
}
