import { notFound } from "next/navigation";
import { Avatar, Button, Card, Empty, Tag } from "antd";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { CommunityScreen } from "@/features/community/components/community-screen";
import { CommunityEditRegion } from "@/features/community/components/community-data-sections";
import { BackendForm } from "@/features/content/components/content-editor-form";
import { EditModal } from "@/features/content/components/edit-modal";
import { SectionError } from "@/features/errors/components/section-error";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvents, getPosts, getRideGroup } from "@/lib/content-api";
import { captureData } from "@/lib/data-result";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";
import { joinGroupAction, leaveGroupAction } from "../actions";

export default async function RideGroupPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{
    compose?: string;
    post?: string;
    modal?: string;
  }>;
}) {
  const [{ slug }, query, locale, session] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
  ]);
  const groupResult = await captureData(() =>
    getRideGroup(slug, session?.accessToken),
  );
  if (
    groupResult.status === "error" &&
    groupResult.error.category === "not-found"
  )
    notFound();
  if (groupResult.status === "error")
    return (
      <main className="community-section-page">
        <SectionError
          category={groupResult.error.category}
          message={
            locale === "th" ? "โหลดกลุ่มไม่ได้" : "Could not load this group."
          }
          retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
          title={locale === "th" ? "กลุ่มไม่พร้อมใช้งาน" : "Group unavailable"}
        />
      </main>
    );
  const group = groupResult.data;
  const href = `/community/groups/${encodeURIComponent(group.slug)}`;
  const [feedResult, activitiesResult, profile] = await Promise.all([
    captureData(() => getPosts(session?.accessToken, "groups", group.id)),
    captureData(() => getEvents(session?.accessToken)),
    session ? getOwnProfile(session.accessToken).catch(() => null) : null,
  ]);
  const viewer =
    profile?.id && profile.username && profile.displayName
      ? {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
        }
      : null;
  const trips =
    activitiesResult.status === "success"
      ? activitiesResult.data.filter(
          (event) => event.kind === "trip" && event.groupId === group.id,
        )
      : [];
  return (
    <main className="community-section-page ride-group-detail">
      <Breadcrumbs
        items={[
          ...resolveBreadcrumbs("/community/groups", { locale }).map((item) =>
            item.key === "groups"
              ? { ...item, href: "/community/groups" }
              : item,
          ),
          { key: "group", label: group.name },
        ]}
        locale={locale}
      />
      <header className="ride-group-hero">
        <h1 data-route-heading tabIndex={-1}>
          {group.name}
        </h1>
        <p>{group.description}</p>
        <Tag color="green">
          {group.memberCount} {locale === "th" ? "สมาชิก" : group.memberCount === 1 ? "member" : "members"}
        </Tag>
      </header>
      <div className="ride-group-membership">
        {!session ? (
          <PendingLink
            className="community-create-link"
            href={`/login?next=${encodeURIComponent(`${href}?compose=1`)}`}
          >
            {locale === "th" ? "เข้าสู่ระบบเพื่อเข้าร่วม" : "Sign in to join"}
          </PendingLink>
        ) : group.isMember && group.creatorId !== profile?.id ? (
          <form action={leaveGroupAction}>
            <input type="hidden" name="slug" value={slug} />
            <Button htmlType="submit" danger>
              {locale === "th" ? "ออกจากกลุ่ม" : "Leave group"}
            </Button>
          </form>
        ) : !group.isMember && profile?.canWrite ? (
          <form action={joinGroupAction}>
            <input type="hidden" name="slug" value={slug} />
            {query.compose === "1" ? (
              <input type="hidden" name="compose" value="1" />
            ) : null}
            <Button htmlType="submit" type="primary">
              {locale === "th" ? "เข้าร่วมกลุ่ม" : "Join group"}
            </Button>
          </form>
        ) : null}
      </div>
      <div className="ride-group-overview">
        <Card title={locale === "th" ? "สมาชิก" : "Members"} className="ride-group-panel">
          <div className="ride-group-member-list">
            {group.members.map((member) => (
              <PendingLink href={`/users/${encodeURIComponent(member.username)}`} key={member.id}>
                <Avatar size="small">{member.displayName.slice(0, 1)}</Avatar>
                <span>{member.displayName}</span>
              </PendingLink>
            ))}
          </div>
        </Card>
        <Card title={locale === "th" ? "ทริปของกลุ่ม" : "Group trips"} className="ride-group-panel">
          {trips.length ? (
            <div className="ride-group-trip-list">
              {trips.map((event) => (
                <PendingLink href={`/activities/${encodeURIComponent(event.id)}`} key={event.id}>
                  {event.title}
                </PendingLink>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={locale === "th" ? "ยังไม่มีทริปของกลุ่ม" : "No group trips yet"} />
          )}
        </Card>
      </div>
      <section className="ride-group-feed">
        <h2>{locale === "th" ? "โพสต์ในกลุ่ม" : "Group posts"}</h2>
        {feedResult.status === "success" ? (
          <CommunityScreen
            authenticated={Boolean(session)}
            canWrite={profile?.canWrite ?? false}
            category="groups"
            groupId={group.id}
            groupSlug={group.slug}
            isMember={group.isMember}
            locale={locale}
            posts={feedResult.data}
            room="groups"
            viewer={viewer}
          />
        ) : (
          <SectionError
            category={feedResult.error.category}
            message={
              locale === "th" ? "โหลดโพสต์ไม่ได้" : "Posts could not load."
            }
            retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
            title={locale === "th" ? "ฟีดไม่พร้อมใช้งาน" : "Feed unavailable"}
          />
        )}
      </section>
      {query.compose === "1" && group.isMember && profile?.canWrite ? (
        <EditModal
          closeUrl={href}
          title={locale === "th" ? "เขียนโพสต์แรก" : "Write a post"}
        >
          <BackendForm
            defaultCommunityCategory="groups"
            defaultGroupId={group.id}
            initial={null}
            locale={locale}
            type="post"
          />
        </EditModal>
      ) : null}
      {query.modal === "edit" && query.post ? (
        <CommunityEditRegion
          accessToken={session?.accessToken}
          category="groups"
          locale={locale}
          postId={query.post}
          returnHref={href}
        />
      ) : null}
    </main>
  );
}
