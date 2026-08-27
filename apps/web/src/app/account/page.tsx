import { buttonVariants } from "@iride/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { signOut } from "../auth/actions";
import { LanguageSwitcher } from "../language-switcher";

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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-5 py-12 sm:px-8">
      <section className="w-full space-y-7 rounded-3xl border bg-background p-6 shadow-xl shadow-primary/5 sm:p-10">
        <div className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {text.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {text.title}
          </h1>
          <p className="text-muted-foreground">{text.description}</p>
        </div>

        <dl className="space-y-3 rounded-2xl bg-muted p-5 text-sm">
          <div>
            <dt className="text-muted-foreground">{text.username}</dt>
            <dd className="mt-1 font-mono">@{profile.username}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{text.visibility}</dt>
            <dd className="mt-1 capitalize">{profile.visibility}</dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
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
        <LanguageSwitcher locale={locale} returnTo="/account" />
      </section>
    </main>
  );
}
