import { notFound } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile, getPublicProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { AppShell } from "../../(main)/_components/app-shell";
import { UserProfileScreen } from "./user-profile-screen";

export default async function UserProfilePage({ params }: { readonly params:Promise<{username:string}> }) {
  const [{username},locale,session]=await Promise.all([params,getRequestLocale(),getVerifiedWebSession()]);
  const [profile,ownProfile]=await Promise.all([
    getPublicProfile(username,session?.accessToken),
    session?getOwnProfile(session.accessToken).catch(()=>null):Promise.resolve(null),
  ]);
  if(!profile)notFound();
  const ownerProfile=ownProfile?.username===profile.username?ownProfile:null;
  return <AppShell authenticated={Boolean(session)} locale={locale} username={ownProfile?.username??null}><UserProfileScreen locale={locale} ownerProfile={ownerProfile} profile={profile}/></AppShell>;
}
