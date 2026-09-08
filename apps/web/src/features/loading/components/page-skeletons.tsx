import type { Locale } from "@/lib/locale";

import { getLoadingLabel } from "../loading-copy";

interface SkeletonProps {
  readonly locale: Locale;
}

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

export function CommunityFeedSkeleton({ locale }: SkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "community")}
      className="skeleton-stack"
      data-ui="community-feed-skeleton"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </section>
  );
}

export function ProfileSkeleton({ locale }: SkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "profile")}
      className="profile-skeleton skeleton-stack"
      data-ui="profile-skeleton"
    >
      <div aria-hidden="true" className="skeleton-cover" />
      <SkeletonCard lines={4} />
    </section>
  );
}

export function AdminListSkeleton({ locale }: SkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "admin-list")}
      className="skeleton-stack"
      data-ui="admin-list-skeleton"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <SkeletonCard lines={2} key={index} />
      ))}
    </section>
  );
}

export function AdminDetailSkeleton({ locale }: SkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "admin-detail")}
      className="skeleton-stack"
      data-ui="admin-detail-skeleton"
    >
      <SkeletonCard lines={5} />
    </section>
  );
}

export function ActivitiesSkeleton({ locale }: SkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "activities")}
      className="skeleton-stack"
      data-ui="activities-skeleton"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <SkeletonCard lines={3} key={index} />
      ))}
    </section>
  );
}

export function ActivityDetailSkeleton({ locale }: SkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "activity-detail")}
      className="skeleton-stack"
      data-ui="activity-detail-skeleton"
    >
      <div aria-hidden="true" className="skeleton-cover" />
      <SkeletonCard lines={5} />
    </section>
  );
}

export function CreateFormSkeleton({ locale }: SkeletonProps) {
  return (
    <main
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "create")}
      className="create-page skeleton-stack"
      data-ui="create-form-skeleton"
    >
      <div aria-hidden="true" className="skeleton-heading" />
      <SkeletonCard lines={5} />
    </main>
  );
}

export function MapSkeleton({ locale }: SkeletonProps) {
  return (
    <main
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "map")}
      className="map-loading-shell"
      data-ui="map-skeleton"
    >
      <div aria-hidden="true" className="skeleton-map-canvas" />
      <div className="skeleton-map-panel skeleton-stack">
        <div aria-hidden="true" className="skeleton-heading" />
        <SkeletonCard lines={4} />
      </div>
    </main>
  );
}

export function GamesSkeleton({ locale }: SkeletonProps) {
  return (
    <main
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "games")}
      className="standalone-loading skeleton-stack"
      data-ui="games-skeleton"
    >
      <div aria-hidden="true" className="skeleton-heading" />
      <SkeletonCard lines={5} />
    </main>
  );
}

export function GameSkeleton({ locale }: SkeletonProps) {
  return (
    <main
      aria-busy="true"
      aria-label={getLoadingLabel(locale, "game")}
      className="standalone-loading game-loading"
      data-ui="game-skeleton"
    >
      <div aria-hidden="true" className="skeleton-game-stage" />
    </main>
  );
}

export function AppShellSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="กำลังเตรียมพื้นที่ iRide / Loading iRide"
      className="app-frame app-shell-skeleton"
      data-ui="app-shell-skeleton"
    >
      <header className="app-header" aria-hidden="true">
        <div className="header-inner">
          <span className="skeleton-brand" />
          <span className="skeleton-header-actions" />
        </div>
      </header>
      <main className="app-main">
        <div className="skeleton-stack">
          <div aria-hidden="true" className="skeleton-heading" />
          <SkeletonCard lines={4} />
        </div>
      </main>
      <div
        aria-hidden="true"
        className="mobile-nav-shell skeleton-mobile-nav"
      />
    </div>
  );
}
