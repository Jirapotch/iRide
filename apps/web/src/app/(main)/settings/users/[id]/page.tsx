import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-users-api";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { changeUserAccess, removeAdminContent } from "../actions";

export default async function AdminUserPage({ params, searchParams }: { readonly params: Promise<{ readonly id: string }>; readonly searchParams: Promise<{ readonly updated?: string; readonly moderated?: string }> }) {
  const [session, { id }, query, locale] = await Promise.all([getVerifiedWebSession(), params, searchParams, getRequestLocale()]);
  if (!session) redirect("/login");
  const profile = await getOwnProfile(session.accessToken).catch(() => null);
  if (!profile?.canManage) redirect("/");
  const user = await getAdminUser(session.accessToken, id);
  const actions = user.id === profile.id ? [] as const : user.status === "locked" ? ["unlock", "suspend"] as const : user.status === "active" ? ["lock", "suspend"] as const : ["restore"] as const;
  return <main className="admin-user-detail"><Link href="/settings/users">← {locale === "th" ? "รายชื่อผู้ใช้" : "User list"}</Link><section className="premium-card"><header><div><h1>{user.displayName ?? user.username ?? user.id}</h1><p>@{user.username ?? "-"}</p></div><span className={`account-status is-${user.status}`}>{user.role} · {user.status}</span></header>{query.updated || query.moderated ? <p className="admin-success" role="status">{locale === "th" ? "อัปเดตเรียบร้อย" : "Update completed."}</p> : null}<dl><div><dt>ID</dt><dd>{user.id}</dd></div><div><dt>Email</dt><dd>{user.email ?? "—"}</dd></div><div><dt>{locale === "th" ? "สร้างเมื่อ" : "Created"}</dt><dd>{new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en").format(new Date(user.createdAt))}</dd></div></dl>{user.status !== "suspended" && user.username ? <Link className="drawer-row" href={`/users/${encodeURIComponent(user.username)}`}>{locale === "th" ? "ดูโปรไฟล์และจัดการเนื้อหา" : "Open profile and manage content"}</Link> : null}<div className="admin-user-actions">{actions.map((action) => <form action={changeUserAccess} key={action}><input name="id" type="hidden" value={user.id} /><input name="accessAction" type="hidden" value={action} /><button className={action === "suspend" ? "danger-action" : "primary-action"} type="submit">{actionLabel(action, locale)}</button></form>)}</div><section className="admin-content-list"><h2>{locale === "th" ? "เนื้อหาของผู้ใช้" : "User content"}</h2>{user.content?.length ? user.content.map((item) => <article key={`${item.kind}:${item.id}`}><span><strong>{item.title}</strong><small>{item.kind}</small></span><form action={removeAdminContent}><input name="userId" type="hidden" value={user.id} /><input name="id" type="hidden" value={item.id} /><input name="kind" type="hidden" value={item.kind} /><button className="danger-action" type="submit">{locale === "th" ? "ลบ" : "Delete"}</button></form></article>) : <p>{locale === "th" ? "ไม่มีเนื้อหา" : "No content"}</p>}</section></section></main>;
}

function actionLabel(action: "lock" | "unlock" | "suspend" | "restore", locale: "th" | "en") { const labels = { th: { lock: "ล็อก", unlock: "ปลดล็อก", suspend: "ระงับบัญชี", restore: "กู้คืน" }, en: { lock: "Lock", unlock: "Unlock", suspend: "Suspend", restore: "Restore" } } as const; return labels[locale][action]; }
