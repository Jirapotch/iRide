function SkeletonCard({ lines = 3 }: { readonly lines?: number }) {
  return (
    <article aria-hidden="true" className="skeleton-card">
      {Array.from({ length: lines }, (_, index) => (
        <span
          className={`skeleton-line ${index === 0 ? "is-short" : index === lines - 1 ? "is-medium" : ""}`}
          key={index}
        />
      ))}
    </article>
  );
}

export function CommunityFeedSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading community feed"
      className="skeleton-stack"
      data-ui="community-feed-skeleton"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </section>
  );
}

export function ProfileSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading profile"
      className="profile-skeleton skeleton-stack"
      data-ui="profile-skeleton"
    >
      <div aria-hidden="true" className="skeleton-cover" />
      <SkeletonCard lines={4} />
    </section>
  );
}

export function AdminListSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading users"
      className="skeleton-stack"
      data-ui="admin-list-skeleton"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <SkeletonCard lines={2} key={index} />
      ))}
    </section>
  );
}

export function AdminDetailSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading user detail"
      className="skeleton-stack"
      data-ui="admin-detail-skeleton"
    >
      <SkeletonCard lines={5} />
    </section>
  );
}

export function CreateFormSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading create form"
      className="create-page skeleton-stack"
      data-ui="create-form-skeleton"
    >
      <div aria-hidden="true" className="skeleton-heading" />
      <SkeletonCard lines={5} />
    </main>
  );
}
