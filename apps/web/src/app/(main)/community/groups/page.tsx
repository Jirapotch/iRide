import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { Button, Card, Empty, Input, Tag } from "antd";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { SectionError } from "@/features/errors/components/section-error";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRideGroups } from "@/lib/content-api";
import { captureData } from "@/lib/data-result";
import { getOwnProfile } from "@/lib/profile-api";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getRequestLocale } from "@/lib/request-locale";
import { createGroupAction } from "./actions";

export default async function GroupsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ post?: string; modal?: string }>;
}) {
  const [locale, query, session] = await Promise.all([
    getRequestLocale(),
    searchParams,
    getVerifiedWebSession().catch(() => null),
  ]);
  if (query.post) {
    const suffix = new URLSearchParams({ post: query.post });
    if (query.modal === "edit") suffix.set("modal", "edit");
    redirect(`/community/groups/iride-general?${suffix.toString()}`);
  }
  const [result, profile] = await Promise.all([
    captureData(() => getRideGroups(session?.accessToken)),
    session ? getOwnProfile(session.accessToken).catch(() => null) : null,
  ]);
  return (
    <main className="community-section-page">
      <Breadcrumbs
        items={resolveBreadcrumbs("/community/groups", { locale })}
        locale={locale}
      />
      <header>
        <UsersThreeIcon size={44} weight="duotone" />
        <h1 data-route-heading tabIndex={-1}>
          {locale === "th" ? "กลุ่ม" : "Groups"}
        </h1>
        <p>
          {locale === "th"
            ? "เลือกกลุ่มที่สนใจ พบเพื่อนร่วมทางและทริปของกลุ่ม"
            : "Find riders and trips in a group you enjoy."}
        </p>
      </header>
      {result.status === "error" ? (
        <SectionError
          category={result.error.category}
          message={
            locale === "th" ? "โหลดรายการกลุ่มไม่ได้" : "Groups could not load."
          }
          retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
          title={locale === "th" ? "กลุ่มไม่พร้อมใช้งาน" : "Groups unavailable"}
        />
      ) : (
        result.data.length ? (
          <div className="ride-group-grid">
            {result.data.map((group) => (
              <PendingLink href={`/community/groups/${encodeURIComponent(group.slug)}`} key={group.id}>
                <Card hoverable className="ride-group-card" title={group.name}>
                  <p>{group.description}</p>
                  <Tag color="green">{group.memberCount} {locale === "th" ? "สมาชิก" : group.memberCount === 1 ? "member" : "members"}</Tag>
                </Card>
              </PendingLink>
            ))}
          </div>
        ) : (
          <Empty description={locale === "th" ? "ยังไม่มีกลุ่ม" : "No groups yet"} />
        )
      )}
      {profile?.canWrite ? (
        <Card className="ride-group-create" title={locale === "th" ? "สร้างกลุ่มใหม่" : "Create a group"}>
          <form action={createGroupAction} className="form-stack">
            <label className="form-field">
              <span>{locale === "th" ? "ชื่อกลุ่ม" : "Group name"}</span>
              <Input name="name" minLength={2} maxLength={80} required />
            </label>
            <label className="form-field">
              <span>{locale === "th" ? "คำอธิบาย" : "Description"}</span>
              <Input.TextArea name="description" maxLength={500} />
            </label>
            <Button htmlType="submit" type="primary">
              {locale === "th" ? "สร้างกลุ่ม" : "Create group"}
            </Button>
          </form>
        </Card>
      ) : !session ? (
        <PendingLink
          className="community-create-link"
          href="/login?next=%2Fcommunity%2Fgroups"
        >
          {locale === "th"
            ? "เข้าสู่ระบบเพื่อสร้างกลุ่ม"
            : "Sign in to create a group"}
        </PendingLink>
      ) : null}
    </main>
  );
}
