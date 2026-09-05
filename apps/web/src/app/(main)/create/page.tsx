import { getRequestLocale } from "@/lib/request-locale";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvents } from "@/lib/content-api";
import { getOwnProfile } from "@/lib/profile-api";
import { communityCategories, type CommunityCategory } from "@iride/types";
import { createContentTypes, type CreateContentType } from "@/lib/create-content-domain";
import { legacyEditRedirect } from "@/lib/edit-modal-domain";
import { CreateContentScreen } from "../_components/create-content-screen";

export default async function CreatePage({ searchParams }: { readonly searchParams: Promise<{ type?: string; edit?: string; category?: string }> }) {
  const [session, params, locale] = await Promise.all([getVerifiedWebSession(), searchParams, getRequestLocale()]);
  if (params.type === "photographer-spot" || params.type === "market") redirect("/");
  const type: CreateContentType = createContentTypes.includes(params.type as CreateContentType) ? params.type as CreateContentType : "post";
  if (!session) redirect(`/login?next=${encodeURIComponent(`/create?type=${type}`)}`);
  if(params.edit)redirect(legacyEditRedirect(type,params.edit));
  const profile = await getOwnProfile(session.accessToken).catch(() => null);
  if (!profile?.canWrite) {
    return <main className="create-page"><section className="create-card premium-card access-wait-state"><h1>{locale === "th" ? "บัญชียังไม่พร้อมสร้างเนื้อหา" : "Your account is read-only"}</h1><p>{locale === "th" ? "กรุณารอผู้ดูแลระบบปลดล็อกบัญชีก่อน แล้วจึงกลับมาสร้างโพสต์หรือกิจกรรม" : "Please wait for an administrator to unlock your account before creating content."}</p></section></main>;
  }
  const events = await getEvents(session.accessToken).catch(() => []);
  const markerOptions = events.map((item) => ({ kind: "event" as const, id: item.id, title: item.title, subtitle: item.locationLabel }));
  const category = communityCategories.includes(params.category as CommunityCategory) ? params.category as CommunityCategory : "groups";
  return <CreateContentScreen defaultCommunityCategory={category} initial={null} locale={locale} markerOptions={markerOptions} type={type} />;
}
