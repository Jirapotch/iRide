import { redirect } from "next/navigation";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { safeReturnPath } from "@/lib/auth-redirect";
import { getAdminUser } from "@/lib/admin-users-api";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { changeUserAccess, removeAdminContent } from "../actions";
import { Breadcrumbs } from "../../../_components/breadcrumbs";
import { HistoryBackButton } from "../../../_components/history-back-button";
import { ActionSubmitButton } from "../../../_components/action-submit-button";
import { PendingLink } from "../../../_components/pending-link";

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{
    readonly updated?: string;
    readonly moderated?: string;
    readonly from?: string;
  }>;
}) {
  const [session, { id }, query, locale] = await Promise.all([
    getVerifiedWebSession(),
    params,
    searchParams,
    getRequestLocale(),
  ]);
  if (!session) redirect("/login");
  const profile = await getOwnProfile(session.accessToken).catch(() => null);
  if (!profile?.canManage) redirect("/");
  const user = await getAdminUser(session.accessToken, id);
  const returnHref = safeReturnPath(query.from, "/settings/users");
  const label = user.displayName ?? user.username ?? user.id;
  const actions =
    user.id === profile.id
      ? ([] as const)
      : user.status === "locked"
        ? (["unlock", "suspend"] as const)
        : user.status === "active"
          ? (["lock", "suspend"] as const)
          : (["restore"] as const);
  return (
    <main className="admin-user-detail">
      <Breadcrumbs
        items={resolveBreadcrumbs(`/settings/users/${encodeURIComponent(id)}`, {
          entityLabel: label,
          locale,
          parentHref: returnHref,
        })}
        locale={locale}
      />
      <HistoryBackButton
        fallbackHref={returnHref}
        label={locale === "th" ? "กลับไปรายชื่อผู้ใช้" : "Back to user list"}
        originKey="iride:admin-users-origin"
      />
      <section className="premium-card">
        <header>
          <div>
            <h1 data-route-heading tabIndex={-1}>
              {label}
            </h1>
            <p>@{user.username ?? "-"}</p>
          </div>
          <span className={`account-status is-${user.status}`}>
            {user.role} · {user.status}
          </span>
        </header>
        {query.updated || query.moderated ? (
          <p className="admin-success" role="status">
            {locale === "th" ? "อัปเดตเรียบร้อย" : "Update completed."}
          </p>
        ) : null}
        <dl>
          <div>
            <dt>ID</dt>
            <dd>{user.id}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt>{locale === "th" ? "สร้างเมื่อ" : "Created"}</dt>
            <dd>
              {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en").format(
                new Date(user.createdAt),
              )}
            </dd>
          </div>
        </dl>
        {user.status !== "suspended" && user.username ? (
          <PendingLink
            className="drawer-row"
            href={`/users/${encodeURIComponent(user.username)}`}
          >
            {locale === "th"
              ? "ดูโปรไฟล์และจัดการเนื้อหา"
              : "Open profile and manage content"}
          </PendingLink>
        ) : null}
        <div className="admin-user-actions">
          {actions.map((action) => (
            <form action={changeUserAccess} key={action}>
              <input name="id" type="hidden" value={user.id} />
              <input name="from" type="hidden" value={returnHref} />
              <input name="accessAction" type="hidden" value={action} />
              <ActionSubmitButton
                ariaLabel={actionLabel(action, locale)}
                className={
                  action === "suspend" ? "danger-action" : "primary-action"
                }
                pendingLabel={actionPendingLabel(action, locale)}
              >
                {actionLabel(action, locale)}
              </ActionSubmitButton>
            </form>
          ))}
        </div>
        <section className="admin-content-list">
          <h2>{locale === "th" ? "เนื้อหาของผู้ใช้" : "User content"}</h2>
          {user.content?.length ? (
            user.content.map((item) => (
              <article key={`${item.kind}:${item.id}`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.kind}</small>
                </span>
                <form action={removeAdminContent}>
                  <input name="userId" type="hidden" value={user.id} />
                  <input name="from" type="hidden" value={returnHref} />
                  <input name="id" type="hidden" value={item.id} />
                  <input name="kind" type="hidden" value={item.kind} />
                  <ActionSubmitButton
                    ariaLabel={locale === "th" ? "ลบ" : "Delete"}
                    className="danger-action"
                    pendingLabel={locale === "th" ? "กำลังลบ…" : "Deleting…"}
                  >
                    {locale === "th" ? "ลบ" : "Delete"}
                  </ActionSubmitButton>
                </form>
              </article>
            ))
          ) : (
            <p>{locale === "th" ? "ไม่มีเนื้อหา" : "No content"}</p>
          )}
        </section>
      </section>
    </main>
  );
}

function actionPendingLabel(
  action: "lock" | "unlock" | "suspend" | "restore",
  locale: "th" | "en",
) {
  const labels = {
    th: {
      lock: "กำลังล็อก…",
      unlock: "กำลังปลดล็อก…",
      suspend: "กำลังระงับ…",
      restore: "กำลังกู้คืน…",
    },
    en: {
      lock: "Locking…",
      unlock: "Unlocking…",
      suspend: "Suspending…",
      restore: "Restoring…",
    },
  } as const;
  return labels[locale][action];
}

function actionLabel(
  action: "lock" | "unlock" | "suspend" | "restore",
  locale: "th" | "en",
) {
  const labels = {
    th: {
      lock: "ล็อก",
      unlock: "ปลดล็อก",
      suspend: "ระงับบัญชี",
      restore: "กู้คืน",
    },
    en: {
      lock: "Lock",
      unlock: "Unlock",
      suspend: "Suspend",
      restore: "Restore",
    },
  } as const;
  return labels[locale][action];
}
