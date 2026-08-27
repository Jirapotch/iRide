import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { completeOnboarding } from "../profile/actions";
import { ProfileForm } from "../profile/profile-form";

const copy = {
  th: {
    eyebrow: "เริ่มต้นใช้งาน",
    title: "สร้างโปรไฟล์ของคุณ",
    description: "เลือกชื่อที่คนอื่นจะใช้ค้นหาและรู้จักคุณบน iRide",
  },
  en: {
    eyebrow: "Get started",
    title: "Create your profile",
    description:
      "Choose how other riders will find and recognize you on iRide.",
  },
} as const;

export default async function OnboardingPage() {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession(),
  ]);
  if (!session) redirect("/login?next=%2Fonboarding");
  const profile = await getOwnProfile(session.accessToken);
  if (profile.isComplete && profile.username)
    redirect(`/users/${profile.username}`);
  const text = copy[locale];

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-10 sm:px-8 sm:py-16">
      <section className="space-y-7 rounded-3xl border bg-background p-6 shadow-xl shadow-primary/5 sm:p-9">
        <div className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {text.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {text.title}
          </h1>
          <p className="leading-6 text-muted-foreground">{text.description}</p>
        </div>
        <ProfileForm
          action={completeOnboarding}
          initialProfile={profile}
          locale={locale}
        />
      </section>
    </main>
  );
}
