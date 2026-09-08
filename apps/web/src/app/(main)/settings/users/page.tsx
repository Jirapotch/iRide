import { redirect } from "next/navigation";
import { Suspense } from "react";
import Form from "next/form";

import { ActionSubmitButton } from "@/features/content/components/action-submit-button";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { listAdminUsers } from "@/lib/admin-users-api";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { AdminUserDirectory } from "@/features/admin/admin-user-directory";
import {
  adminUsersHref,
  resolveBreadcrumbs,
} from "@/lib/app-navigation-domain";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { AdminListSkeleton } from "@/features/loading/components/page-skeletons";
import { SectionError } from "@/features/errors/components/section-error";
import { captureData } from "@/lib/data-result";

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
  return (
    <main className="admin-users-page">
      <Breadcrumbs
        items={resolveBreadcrumbs("/settings/users", { locale })}
        locale={locale}
      />
      <header>
        <h1 data-route-heading tabIndex={-1}>
          {locale === "th" ? "จัดการผู้ใช้" : "Manage users"}
        </h1>
        <p>
          {locale === "th" ? "ค้นหาและจัดการบัญชี" : "Find and manage accounts"}
        </p>
      </header>
      <Form action="/settings/users" className="admin-user-search">
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
        <ActionSubmitButton
          pendingLabel={locale === "th" ? "กำลังค้นหา…" : "Searching…"}
        >
          {locale === "th" ? "ค้นหา" : "Search"}
        </ActionSubmitButton>
        {q ? (
          <PendingLink className="admin-search-clear" href="/settings/users">
            {locale === "th" ? "ล้างการค้นหา" : "Clear search"}
          </PendingLink>
        ) : null}
      </Form>
      <section data-navigation-focus-target="admin-results" tabIndex={-1}>
        <Suspense
          fallback={<AdminListSkeleton locale={locale} />}
          key={`${q}:${page}`}
        >
          <AdminUsersRegion
            accessToken={session.accessToken}
            locale={locale}
            page={page}
            q={q}
          />
        </Suspense>
      </section>
    </main>
  );
}

async function AdminUsersRegion({
  accessToken,
  locale,
  page,
  q,
}: {
  readonly accessToken: string;
  readonly locale: "th" | "en";
  readonly page: number;
  readonly q: string;
}) {
  const resultState = await captureData(() =>
    listAdminUsers(accessToken, q, page),
  );
  if (resultState.status === "error") {
    return (
      <SectionError
        category={resultState.error.category}
        message={
          locale === "th"
            ? "ยังโหลดรายชื่อผู้ใช้ไม่ได้ ส่วนค้นหาและเมนูยังใช้งานได้"
            : "The user list could not load. Search and navigation are still available."
        }
        retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
        title={locale === "th" ? "โหลดรายชื่อไม่ได้" : "User list unavailable"}
      />
    );
  }
  const result = resultState.data;
  const hasNext = page * result.pageSize < result.total;
  const returnHref = adminUsersHref({ q, page });
  return (
    <>
      <p aria-live="polite" className="admin-user-count">
        {locale === "th" ? `${result.total} บัญชี` : `${result.total} accounts`}
      </p>
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
    </>
  );
}
