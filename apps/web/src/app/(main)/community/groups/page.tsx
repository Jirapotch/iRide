import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { CommunityFeedPage } from "@/features/community/components/community-feed-page";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getRequestLocale } from "@/lib/request-locale";

const copy = {
  th: {
    group: "กลุ่ม",
  },
  en: {
    group: "Group",
  },
} as const;

export default async function GroupsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly modal?: string;
    readonly post?: string;
  }>;
}) {
  const locale = await getRequestLocale();
  const text = copy[locale];
  const breadcrumbs = resolveBreadcrumbs(`/community/groups`, { locale });
  return (
    <main className="community-section-page">
      <Breadcrumbs items={breadcrumbs} locale={locale} />
      <header>
        <UsersThreeIcon size={44} weight="duotone" />
        <h1 data-route-heading tabIndex={-1}>
          {text["group"]}
        </h1>
      </header>
      <CommunityFeedPage
        category="groups"
        room="groups"
        searchParams={searchParams}
      />
    </main>
  );
}
