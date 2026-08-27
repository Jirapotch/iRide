import { getRequestLocale } from "@/lib/request-locale";

import { PageIntro } from "../_components/page-intro";

const copy = {
  th: {
    eyebrow: "ค้นพบระหว่างทาง",
    title: "สำรวจเส้นทาง",
    description: "มองหาจุดหมาย สถานที่นัดพบ และกิจกรรมของชุมชนรอบตัวคุณ",
    search: "ค้นหาสถานที่หรือพื้นที่",
    filters: ["ใกล้ฉัน", "จุดนัดพบ", "เส้นทางยอดนิยม"],
    map: "พื้นที่แผนที่",
    mapNote: "แผนที่และตำแหน่งชุมชนจะแสดงที่นี่",
    list: "รายการสถานที่",
  },
  en: {
    eyebrow: "Discover what is nearby",
    title: "Explore the road",
    description:
      "Find destinations, meet-up spots, and community activity around you.",
    search: "Search places or areas",
    filters: ["Near me", "Meet-up spots", "Popular roads"],
    map: "Map area",
    mapNote: "The map and community locations will appear here.",
    list: "Place list",
  },
} as const;

export default async function ExplorePage() {
  const locale = await getRequestLocale();
  const text = copy[locale];

  return (
    <div className="space-y-8">
      <PageIntro
        description={text.description}
        eyebrow={text.eyebrow}
        title={text.title}
      />

      <section className="overflow-hidden rounded-[2rem] border border-border bg-surface">
        <div className="border-b border-border p-5 sm:p-6">
          <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-background/40 px-4 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full border border-primary"
            />
            {text.search}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {text.filters.map((filter, index) => (
              <button
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                  index === 0
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
                disabled
                key={filter}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div
            aria-label={text.map}
            className="relative grid min-h-[28rem] place-items-center overflow-hidden bg-background/65 p-8 text-center"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:44px_44px]"
            />
            <div
              aria-hidden="true"
              className="absolute left-[22%] top-[32%] h-4 w-4 rounded-full border-4 border-background bg-primary shadow-[0_0_0_8px_color-mix(in_srgb,var(--primary)_12%,transparent),0_0_22px_var(--primary)]"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-[26%] right-[24%] h-3 w-3 rounded-full bg-foreground/55 shadow-[0_0_0_7px_rgb(255_255_255_/_0.08)]"
            />
            <div className="relative max-w-xs rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur">
              <p className="text-sm font-bold">{text.map}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {text.mapNote}
              </p>
            </div>
          </div>
          <aside
            aria-label={text.list}
            className="hidden border-l border-border p-6 lg:block"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {text.list}
            </p>
            <div className="mt-6 space-y-3">
              {[0, 1, 2].map((item) => (
                <div
                  className="rounded-2xl border border-border p-4"
                  key={item}
                >
                  <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
                  <div className="mt-3 h-2 w-2/5 rounded-full bg-foreground/[0.05]" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
