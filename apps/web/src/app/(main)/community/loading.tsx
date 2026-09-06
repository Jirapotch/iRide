import { CommunityFeedSkeleton } from "../_components/page-skeletons";

export default function CommunityLoading() {
  return (
    <main className="community-page">
      <header className="community-heading">
        <div aria-hidden="true" className="skeleton-heading" />
      </header>
      <CommunityFeedSkeleton />
    </main>
  );
}
