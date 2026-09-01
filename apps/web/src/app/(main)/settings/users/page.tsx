import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { listAdminUsers } from "@/lib/admin-users-api";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminUsersPage({ searchParams }: { readonly searchParams: Promise<{ readonly q?: string; readonly page?: string }> }) {
  const [session, query, locale] = await Promise.all([getVerifiedWebSession(), searchParams, getRequestLocale()]);
  if (!session) redirect("/login");
  const profile = await getOwnProfile(session.accessToken).catch(() => null);
  if (!profile?.canManage) redirect("/");
  const q = query.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const result = await listAdminUsers(session.accessToken, q, page);
  const hasNext = page * result.pageSize < result.total;
  return <main className="admin-users-page"><header><h1>{locale === "th" ? "จัดการผู้ใช้" : "Manage users"}</h1><p>{locale === "th" ? `${result.total} บัญชี` : `${result.total} accounts`}</p></header><form className="admin-user-search"><input defaultValue={q} name="q" placeholder={locale === "th" ? "ค้นหาชื่อหรือ username" : "Search name or username"} /><button type="submit">{locale === "th" ? "ค้นหา" : "Search"}</button></form><div className="admin-user-list">{result.data.map((user) => <Link href={`/settings/users/${user.id}`} key={user.id}><span><strong>{user.displayName ?? (locale === "th" ? "ยังไม่มีชื่อ" : "No name")}</strong><small>@{user.username ?? "-"}</small></span><span className={`account-status is-${user.status}`}>{user.role} · {user.status}</span></Link>)}</div><nav className="admin-pagination" aria-label="Pagination">{page > 1 ? <Link href={`/settings/users?q=${encodeURIComponent(q)}&page=${page - 1}`}>← {locale === "th" ? "ก่อนหน้า" : "Previous"}</Link> : <span />}{hasNext ? <Link href={`/settings/users?q=${encodeURIComponent(q)}&page=${page + 1}`}>{locale === "th" ? "ถัดไป" : "Next"} →</Link> : null}</nav></main>;
}
