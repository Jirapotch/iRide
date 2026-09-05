"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { deleteAdminModeratedContent, updateAdminUser, type AdminUserAction } from "@/lib/admin-users-api";
import { getOwnProfile } from "@/lib/profile-api";

export async function changeUserAccess(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("accessAction") ?? "") as AdminUserAction;
  if (!id || !["lock", "unlock", "suspend", "restore"].includes(action)) throw new Error("INVALID_ADMIN_ACTION");
  await updateAdminUser(session.accessToken, id, action);
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${id}`);
  redirect(`/settings/users/${id}?updated=${action}`);
}

export async function removeAdminContent(formData: FormData) {
  const session = await getVerifiedWebSession();
  if (!session) redirect("/login");
  const profile = await getOwnProfile(session.accessToken);
  if (!profile.canManage) throw new Error("ADMIN_FORBIDDEN");
  const userId = String(formData.get("userId") ?? "");
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "post" && kind !== "event" && kind !== "vehicle") throw new Error("INVALID_ADMIN_CONTENT");
  await deleteAdminModeratedContent(session.accessToken, id, kind);
  revalidatePath(`/settings/users/${userId}`);
  redirect(`/settings/users/${userId}?moderated=1`);
}
