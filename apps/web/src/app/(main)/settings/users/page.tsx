import { redirect } from "next/navigation";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { listAdminUsers } from "@/lib/admin-users-api";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { AdminUserDirectory } from "@/features/admin/admin-user-directory";
import {
  adminUsersHref,
  resolveBreadcrumbs,
} from "@/lib/app-navigation-domain";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { PendingLink } from "../../_components/pending-link";

export default async function AdminUsersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly q?: string;
    readonly page?: string;
  }>;
}) {
  const [session, query, locale] = await Promise.all([
    getVerifiedWebSession(),
    searchParams,
    getRequestLocale(),
  ]);
  if (!session) redirect("/login");
  const profile = await getOwnProfile(session.accessToken).catch(() => null);
  if (!profile?.canManage) redirect("/");
  const q = query.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const result = await listAdminUsers(session.accessToken, q, page);
  const hasNext = page * result.pageSize < result.total;
  const returnHref = adminUsersHref({ q, page });
  return (
    <main className="admin-users-page">
      <Breadcrumbs items={resolveBreadcrumbs("/settings/users", { locale })} />
      <header>
        <h1 data-route-heading tabIndex={-1}>
          {locale === "th" ? "จัดการผู้ใช้" : "Manage users"}
        </h1>
        <p>
          {locale === "th"
            ? `${result.total} บัญชี`
            : `${result.total} accounts`}
        </p>
      </header>
      <form className="admin-user-search">
        <input
          aria-label={locale === "th" ? "ค้นหาผู้ใช้" : "Search users"}
          defaultValue={q}
          name="q"
          placeholder={
            locale === "th"
              ? "ค้นหาชื่อ username หรือ email"
              : "Search name, username, or email"
          }
        />
        <button type="submit">{locale === "th" ? "ค้นหา" : "Search"}</button>
        {q ? (
          <PendingLink className="admin-search-clear" href="/settings/users">
            {locale === "th" ? "ล้างการค้นหา" : "Clear search"}
          </PendingLink>
        ) : null}
      </form>
      <AdminUserDirectory
        locale={locale}
        returnHref={returnHref}
        users={result.data}
      />
      <nav className="admin-pagination" aria-label="Pagination">
        {page > 1 ? (
          <PendingLink href={adminUsersHref({ q, page: page - 1 })}>
            ← {locale === "th" ? "ก่อนหน้า" : "Previous"}
          </PendingLink>
        ) : (
          <span />
        )}
        {hasNext ? (
          <PendingLink href={adminUsersHref({ q, page: page + 1 })}>
            {locale === "th" ? "ถัดไป" : "Next"} →
          </PendingLink>
        ) : null}
      </nav>
    </main>
  );
}
