import Link from "next/link";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";

import { PageIntro } from "../_components/page-intro";

const copy = {
  th: {
    eyebrow: "ตัวตนบน iRide",
    title: "โปรไฟล์ของคุณ",
    description: "พื้นที่รวมตัวตน เรื่องราว รถ และชุมชนที่คุณเป็นส่วนหนึ่ง",
    preview: "ภาพรวมโปรไฟล์",
    account: "จัดการบัญชี",
    settings: "การตั้งค่าโปรไฟล์",
    garage: "รถในโรงรถ",
    posts: "เรื่องราวของฉัน",
    note: "ข้อมูลโปรไฟล์ฉบับเต็มจะเชื่อมต่อในขั้นถัดไป",
  },
  en: {
    eyebrow: "Your iRide identity",
    title: "Your profile",
    description:
      "A home for your identity, stories, cars, and the communities you belong to.",
    preview: "Profile overview",
    account: "Manage account",
    settings: "Profile settings",
    garage: "Garage vehicles",
    posts: "My stories",
    note: "The complete profile will be connected in the next stage.",
  },
} as const;

export default async function ProfilePage() {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
  ]);
  if (!session) redirect("/login?next=%2Fprofile");
  const text = copy[locale];

  return (
    <div className="space-y-8">
      <PageIntro
        description={text.description}
        eyebrow={text.eyebrow}
        title={text.title}
      />

      <section
        aria-label={text.preview}
        className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]"
      >
        <div className="rounded-[2rem] border border-border bg-surface p-6 text-center">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-primary/30 bg-primary/[0.05]">
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full bg-primary shadow-[0_0_24px_var(--primary)]"
            />
          </div>
          <div className="mx-auto mt-6 h-3 w-32 rounded-full bg-foreground/10" />
          <div className="mx-auto mt-3 h-2 w-20 rounded-full bg-foreground/[0.05]" />
          <p className="mt-7 text-xs leading-5 text-muted-foreground">
            {text.note}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            className="group rounded-[2rem] border border-border bg-surface p-6 transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/account"
          >
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary">
              01
            </span>
            <h2 className="mt-8 text-lg font-bold">{text.account}</h2>
          </Link>
          <Link
            className="group rounded-[2rem] border border-border bg-surface p-6 transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/profile/edit"
          >
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary">
              02
            </span>
            <h2 className="mt-8 text-lg font-bold">{text.settings}</h2>
          </Link>
          <div className="rounded-[2rem] border border-border bg-surface p-6 text-muted-foreground">
            <span className="text-[10px] font-bold tracking-[0.2em] text-foreground/20">
              03
            </span>
            <h2 className="mt-8 text-lg font-bold">{text.garage}</h2>
          </div>
          <div className="rounded-[2rem] border border-border bg-surface p-6 text-muted-foreground">
            <span className="text-[10px] font-bold tracking-[0.2em] text-foreground/20">
              04
            </span>
            <h2 className="mt-8 text-lg font-bold">{text.posts}</h2>
          </div>
        </div>
      </section>
    </div>
  );
}
