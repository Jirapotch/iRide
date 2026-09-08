import { CommunityFeedSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function CommunityLoading() {
  const locale = await getRequestLocale();
  return (
    <main className="community-page">
      <header className="community-heading">
        <div aria-hidden="true" className="skeleton-heading" />
      </header>
      <CommunityFeedSkeleton locale={locale} />
    </main>
  );
}
