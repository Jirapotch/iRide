"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRideGroupSchema } from "@iride/validation";
import { getVerifiedWebSession } from "@/lib/auth-session";
import {
  createRideGroup,
  joinRideGroup,
  leaveRideGroup,
} from "@/lib/content-api";

export async function createGroupAction(formData: FormData): Promise<never> {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login?next=%2Fcommunity%2Fgroups");
  const input = createRideGroupSchema.parse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  const group = await createRideGroup(session.accessToken, input);
  revalidatePath("/community/groups");
  redirect(`/community/groups/${group.slug}`);
}

export async function joinGroupAction(formData: FormData): Promise<never> {
  const slug = String(formData.get("slug") ?? "");
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) redirect("/community/groups");
  const session = await getVerifiedWebSession();
  if (!session)
    redirect(`/login?next=${encodeURIComponent(`/community/groups/${slug}`)}`);
  await joinRideGroup(session.accessToken, slug);
  revalidatePath(`/community/groups/${slug}`);
  redirect(
    `/community/groups/${slug}${formData.get("compose") === "1" ? "?compose=1" : ""}`,
  );
}

export async function leaveGroupAction(formData: FormData): Promise<never> {
  const slug = String(formData.get("slug") ?? "");
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) redirect("/community/groups");
  const session = await getVerifiedWebSession();
  if (!session)
    redirect(`/login?next=${encodeURIComponent(`/community/groups/${slug}`)}`);
  await leaveRideGroup(session.accessToken, slug);
  revalidatePath(`/community/groups/${slug}`);
  redirect(`/community/groups/${slug}`);
}
