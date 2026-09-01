import "server-only";
import type { AccountRole, AccountStatus } from "@iride/types";

export interface AdminUserContentDto { readonly id: string; readonly kind: "post" | "event" | "photographerSpot" | "vehicle"; readonly title: string; readonly communityCategory?: import("@iride/types").CommunityCategory }
export interface AdminUserDto { readonly id: string; readonly username: string | null; readonly displayName: string | null; readonly email: string | null; readonly role: AccountRole; readonly status: AccountStatus; readonly createdAt: string; readonly updatedAt: string; readonly content?: readonly AdminUserContentDto[] }
export interface AdminUsersPage { readonly data: readonly AdminUserDto[]; readonly page: number; readonly pageSize: number; readonly total: number }
export type AdminUserAction = "lock" | "unlock" | "suspend" | "restore";

export function listAdminUsers(accessToken: string, q: string, page: number) {
  const query = new URLSearchParams({ page: String(page) });
  if (q) query.set("q", q);
  return adminFetch<AdminUsersPage>(`/api/v1/admin/users?${query}`, accessToken);
}
export function getAdminUser(accessToken: string, id: string) { return adminFetch<{ readonly data: AdminUserDto }>(`/api/v1/admin/users/${encodeURIComponent(id)}`, accessToken).then((body) => body.data); }
export function updateAdminUser(accessToken: string, id: string, action: AdminUserAction) { return adminFetch<{ readonly data: AdminUserDto }>(`/api/v1/admin/users/${encodeURIComponent(id)}`, accessToken, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then((body) => body.data); }
export function deleteAdminModeratedContent(accessToken: string, id: string, kind: AdminUserContentDto["kind"]) { return adminFetch<void>("/api/v1/admin/moderation", accessToken, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, kind }) }); }

async function adminFetch<T>(pathname: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(pathname, process.env.NEXT_PUBLIC_API_URL?.trim() ?? "http://localhost:3001"), { ...init, cache: "no-store", headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`ADMIN_USERS_${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
