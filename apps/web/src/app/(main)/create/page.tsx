import { getRequestLocale } from "@/lib/request-locale";

import { PageIntro } from "../_components/page-intro";

const copy = {
  th: {
    eyebrow: "แบ่งปันการเดินทาง",
    title: "สร้างเรื่องราว",
    description:
      "บันทึกช่วงเวลาบนถนน แล้วเชื่อมเรื่องราวเข้ากับรถคันที่พาคุณไป",
    composer: "คุณอยากเล่าอะไรเกี่ยวกับการเดินทางครั้งนี้?",
    media: "เพิ่มรูปภาพ",
    vehicle: "เลือกรถจากโรงรถ",
    publish: "เผยแพร่เรื่องราว",
    note: "ตัวแก้ไขโพสต์จะเปิดใช้งานในขั้นถัดไป",
  },
  en: {
    eyebrow: "Share the drive",
    title: "Create a story",
    description:
      "Capture a moment on the road and connect it with the car that took you there.",
    composer: "What would you like to share about this drive?",
    media: "Add images",
    vehicle: "Choose from garage",
    publish: "Publish story",
    note: "The post editor will be enabled in the next stage.",
  },
} as const;

export default async function CreatePage() {
  const locale = await getRequestLocale();
  const text = copy[locale];

  return (
    <div className="space-y-8">
      <PageIntro
        description={text.description}
        eyebrow={text.eyebrow}
        title={text.title}
      />

      <section className="mx-auto max-w-3xl rounded-[2rem] border border-border bg-surface p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/[0.06]"
          >
            <span className="h-2 w-2 rounded-full bg-primary" />
          </div>
          <div className="min-h-36 flex-1 rounded-2xl border border-dashed border-border bg-background/30 p-5 text-sm leading-6 text-muted-foreground">
            {text.composer}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[text.media, text.vehicle].map((label) => (
            <button
              className="flex min-h-20 items-center justify-between rounded-2xl border border-border bg-foreground/[0.025] px-5 text-left text-sm font-semibold text-muted-foreground"
              disabled
              key={label}
              type="button"
            >
              {label}
              <span aria-hidden="true" className="text-lg text-primary">
                +
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{text.note}</p>
          <button
            className="rounded-full bg-primary/35 px-5 py-3 text-xs font-black text-primary-foreground/60"
            disabled
            type="button"
          >
            {text.publish}
          </button>
        </div>
      </section>
    </div>
  );
}
