import { getRequestLocale } from "@/lib/request-locale";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvent, getPhotographerSpot, getPost } from "@/lib/content-api";
import { CreateContentScreen } from "../_components/create-content-screen";

const createTypes = ["post", "activity", "trip", "photographer-spot", "market"] as const;
type CreateType = (typeof createTypes)[number];

export default async function CreatePage({ searchParams }: { readonly searchParams: Promise<{ type?: string; edit?: string }> }) {
  const session = await getVerifiedWebSession();
  const params = await searchParams;
  const type: CreateType = createTypes.includes(params.type as CreateType) ? params.type as CreateType : "post";
  if (!session) redirect(`/login?next=${encodeURIComponent(`/create?type=${type}`)}`);
  const initial = params.edit ? await loadInitial(type, params.edit, session.accessToken) : null;
  if (initial && !initial.canEdit) redirect("/");
  return <CreateContentScreen initial={initial} locale={await getRequestLocale()} type={type} />;
}

function loadInitial(type: CreateType, id: string, token: string) {
  if (type === "post") return getPost(id, token);
  if (type === "photographer-spot") return getPhotographerSpot(id, token);
  if (type === "activity" || type === "trip") return getEvent(id, token);
  return Promise.resolve(null);
}
