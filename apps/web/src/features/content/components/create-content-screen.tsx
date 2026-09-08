"use client";

import type { CommunityCategory } from "@iride/types";

import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { SectionError } from "@/features/errors/components/section-error";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import type { Locale } from "@/lib/locale";

import { useCreateMarkerOptions } from "../create-marker-options-context";
import { BackendForm, type InitialContent } from "./content-editor-form";

type CreateType = "post" | "activity" | "trip";

export type { InitialContent } from "./content-editor-form";

export function CreateContentScreen({
  locale,
  type,
  initial,
  defaultCommunityCategory = "groups",
}: {
  readonly locale: Locale;
  readonly type: CreateType;
  readonly initial: InitialContent;
  readonly defaultCommunityCategory?: CommunityCategory;
}) {
  const { markerOptions, markerOptionsUnavailable } = useCreateMarkerOptions();
  const options: { type: CreateType; label: string }[] = [
    { type: "post", label: locale === "th" ? "โพสต์" : "Post" },
    { type: "activity", label: locale === "th" ? "กิจกรรม" : "Activity" },
    { type: "trip", label: locale === "th" ? "ทริป" : "Trip" },
  ];

  return (
    <main className="create-page">
      <Breadcrumbs
        items={resolveBreadcrumbs("/create", { locale })}
        locale={locale}
      />
      <header className="create-intro">
        <p className="premium-kicker">iRide Create</p>
        <h1 data-route-heading tabIndex={-1}>
          {locale === "th" ? "สร้างสิ่งใหม่" : "Create something new"}
        </h1>
      </header>
      <nav className="create-type-tabs">
        {options.map((option) => (
          <PendingLink
            aria-current={option.type === type ? "page" : undefined}
            href={`/create?type=${option.type}`}
            key={option.type}
          >
            {option.label}
          </PendingLink>
        ))}
      </nav>
      <section
        className="create-card premium-card"
        data-navigation-focus-target="create-form"
        tabIndex={-1}
      >
        {markerOptionsUnavailable ? (
          <SectionError
            category="unavailable"
            message={
              locale === "th"
                ? "ยังค้นหา marker ของกิจกรรมไม่ได้ แต่คุณยังกรอกแบบฟอร์มต่อได้"
                : "Activity markers are unavailable, but you can keep filling out the form."
            }
            retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
            title={
              locale === "th" ? "โหลด marker ไม่ได้" : "Markers unavailable"
            }
          />
        ) : null}
        <BackendForm
          defaultCommunityCategory={defaultCommunityCategory}
          initial={initial}
          locale={locale}
          markerOptions={markerOptions}
          type={type}
        />
      </section>
    </main>
  );
}
