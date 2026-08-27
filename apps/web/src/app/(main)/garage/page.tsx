import { getRequestLocale } from "@/lib/request-locale";

import { PageIntro } from "../_components/page-intro";

const copy = {
  th: {
    eyebrow: "รถทุกคันมีเรื่องราว",
    title: "โรงรถของคุณ",
    description: "รวบรวมรถคันโปรด ภาพถ่าย และเรื่องราวการดูแลไว้ในที่เดียว",
    emptyTitle: "พื้นที่สำหรับรถคันแรกของคุณ",
    emptyDescription:
      "เมื่อ Garage พร้อมใช้งาน คุณจะสร้างโปรไฟล์รถและเชื่อมรถเข้ากับทุกโพสต์ได้",
    action: "เพิ่มรถ",
    collection: "คอลเลกชันรถ",
  },
  en: {
    eyebrow: "Every car has a story",
    title: "Your garage",
    description:
      "Keep favorite cars, photos, and ownership stories together in one place.",
    emptyTitle: "A place for your first car",
    emptyDescription:
      "When Garage goes live, you can build a vehicle profile and connect it to every post.",
    action: "Add a vehicle",
    collection: "Vehicle collection",
  },
} as const;

export default async function GaragePage() {
  const locale = await getRequestLocale();
  const text = copy[locale];

  return (
    <div className="space-y-8">
      <PageIntro
        description={text.description}
        eyebrow={text.eyebrow}
        title={text.title}
      />

      <section
        aria-label={text.collection}
        className="relative min-h-[30rem] overflow-hidden rounded-[2rem] border border-border bg-surface p-6 sm:p-10"
      >
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full border border-primary/15"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-12 -right-4 h-56 w-56 rounded-full border border-foreground/[0.07]"
        />
        <div className="relative grid min-h-[25rem] place-items-center rounded-[1.5rem] border border-dashed border-border bg-background/30 p-8 text-center">
          <div className="max-w-md">
            <div
              aria-hidden="true"
              className="mx-auto flex h-20 w-32 items-end justify-center rounded-[2rem_2rem_1rem_1rem] border border-border pb-3"
            >
              <div className="h-2 w-16 rounded-full bg-primary/60 shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_35%,transparent)]" />
            </div>
            <h2 className="mt-7 text-2xl font-bold tracking-tight">
              {text.emptyTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {text.emptyDescription}
            </p>
            <button
              className="mt-7 rounded-full border border-primary/30 bg-primary/[0.06] px-5 py-3 text-xs font-bold text-primary/50"
              disabled
              type="button"
            >
              {text.action}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
