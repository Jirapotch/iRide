import { getRequestLocale } from "@/lib/request-locale";

const copy = {
  th: {
    eyebrow: "ถนนเส้นเดียวกัน เรื่องราวนับไม่ถ้วน",
    title: "ฟีดของคุณ",
    description: "ติดตามการเดินทาง รถคันโปรด และเรื่องราวใหม่จากชุมชน iRide",
    following: "กำลังติดตาม",
    latest: "ล่าสุด",
    feedLabel: "พื้นที่ฟีด",
    emptyTitle: "เรื่องราวใหม่กำลังมา",
    emptyDescription: "พื้นที่นี้จะรวบรวมโพสต์จากผู้ขับขี่และชุมชนที่คุณติดตาม",
    action: "เริ่มสร้างโพสต์",
  },
  en: {
    eyebrow: "One road. Endless stories.",
    title: "Your feed",
    description:
      "Follow fresh drives, favorite cars, and new stories from the iRide community.",
    following: "Following",
    latest: "Latest",
    feedLabel: "Feed area",
    emptyTitle: "Fresh stories are on the way",
    emptyDescription:
      "This space will bring together posts from the drivers and communities you follow.",
    action: "Start a post",
  },
} as const;

export default async function FeedPage() {
  const locale = await getRequestLocale();
  const text = copy[locale];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface p-6 sm:p-9">
        <div
          className="absolute -right-20 -top-28 h-72 w-72 rounded-full border border-primary/20"
          aria-hidden="true"
        />
        <div
          className="absolute -right-8 -top-16 h-48 w-48 rounded-full border border-border"
          aria-hidden="true"
        />
        <div className="relative max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
            {text.eyebrow}
          </p>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.055em] sm:text-6xl">
            {text.title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            {text.description}
          </p>
        </div>
        <div
          className="relative mt-8 flex gap-2"
          role="group"
          aria-label={locale === "th" ? "ตัวกรองฟีด" : "Feed filters"}
        >
          <button
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            type="button"
          >
            {text.following}
          </button>
          <button
            className="rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground"
            type="button"
          >
            {text.latest}
          </button>
        </div>
      </section>

      <section
        aria-label={text.feedLabel}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <div className="grid min-h-[24rem] place-items-center rounded-[2rem] border border-dashed border-border bg-foreground/[0.025] p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-primary/35 bg-primary/[0.06]">
              <span
                className="h-3 w-3 rounded-full bg-primary shadow-[0_0_18px_var(--primary)]"
                aria-hidden="true"
              />
            </div>
            <h2 className="mt-6 text-xl font-bold tracking-tight">
              {text.emptyTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {text.emptyDescription}
            </p>
            <span
              className="mt-6 inline-flex rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground"
              aria-disabled="true"
            >
              {text.action}
            </span>
          </div>
        </div>
        <aside
          className="hidden rounded-[2rem] border border-border bg-foreground/[0.025] p-6 lg:block"
          aria-label={locale === "th" ? "ภาพรวมชุมชน" : "Community overview"}
        >
          <div className="h-2 w-20 rounded-full bg-foreground/10" />
          <div className="mt-8 space-y-5">
            {["w-4/5", "w-3/5", "w-2/3"].map((width) => (
              <div className="space-y-3" key={width}>
                <div
                  className={`h-2 rounded-full bg-foreground/[0.07] ${width}`}
                />
                <div className="h-2 w-2/5 rounded-full bg-foreground/[0.04]" />
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
