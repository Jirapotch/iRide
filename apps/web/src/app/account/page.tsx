import { buttonVariants } from "@iride/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { AppShell } from "../(main)/_components/app-shell";
import { PageIntro } from "../(main)/_components/page-intro";
import { signOut } from "../auth/actions";

const copy = {
  th: {
    eyebrow: "บัญชีของคุณ",
    title: "จัดการตัวตนบน iRide",
    description: "โปรไฟล์ของคุณพร้อมใช้งานและผ่านการตรวจสอบจาก API แล้ว",
    username: "ชื่อผู้ใช้",
    visibility: "การมองเห็น",
    publicProfile: "ดูโปรไฟล์สาธารณะ",
    edit: "แก้ไขโปรไฟล์",
    home: "กลับหน้าหลัก",
    signOut: "ออกจากระบบ",
  },
  en: {
    eyebrow: "Your account",
    title: "Manage your iRide identity",
    description: "Your profile is ready and verified by the API.",
    username: "Username",
    visibility: "Visibility",
    publicProfile: "View public profile",
    edit: "Edit profile",
    home: "Back home",
    signOut: "Sign out",
  },
} as const;

export default async function AccountPage() {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession(),
  ]);
  if (!session) redirect("/login?next=%2Faccount");

  const profile = await getOwnProfile(session.accessToken);
  if (!profile.isComplete || !profile.username) redirect("/onboarding");
  const text = copy[locale];

  return (
    <AppShell locale={locale}>
      <div className="space-y-8">
        <PageIntro
          description={text.description}
          eyebrow={text.eyebrow}
          title={text.title}
        />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <dl className="grid gap-4 rounded-[2rem] border border-border bg-surface p-6 text-sm sm:grid-cols-2 sm:p-8">
            <div className="rounded-2xl border border-border bg-background/25 p-5">
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {text.username}
              </dt>
              <dd className="mt-4 font-mono text-lg text-primary">
                @{profile.username}
              </dd>
            </div>
            <div className="rounded-2xl border border-border bg-background/25 p-5">
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {text.visibility}
              </dt>
              <dd className="mt-4 text-lg font-semibold capitalize">
                {profile.visibility}
              </dd>
            </div>
          </dl>

          <div className="grid content-start gap-3 rounded-[2rem] border border-border bg-surface p-6">
            <Link
              className={buttonVariants()}
              href={`/users/${profile.username}`}
            >
              {text.publicProfile}
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/profile/edit"
            >
              {text.edit}
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              {text.home}
            </Link>
            <form action={signOut}>
              <button
                className={`${buttonVariants({ variant: "outline" })} w-full`}
                type="submit"
              >
                {text.signOut}
              </button>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
