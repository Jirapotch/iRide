import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { StandaloneShell } from "../_components/standalone-shell";
import { LanguageSwitcher } from "../language-switcher";
import { SignOutButton } from "../auth/sign-out-button";
import { completeOnboarding } from "../profile/actions";
import { ProfileForm } from "../profile/profile-form";

const copy = {
  th: {
    eyebrow: "เริ่มต้นใช้งาน",
    title: "สร้างโปรไฟล์ของคุณ",
    description: "เลือกชื่อที่คนอื่นจะใช้ค้นหาและรู้จักคุณบน iRide",
    signOut: "ออกจากระบบ",
  },
  en: {
    eyebrow: "Get started",
    title: "Create your profile",
    description:
      "Choose how other riders will find and recognize you on iRide.",
    signOut: "Sign out",
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
    <StandaloneShell
      headerAction={<SignOutButton label={text.signOut} />}
      locale={locale}
      wide
    >
      <div className="space-y-7">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
            {text.eyebrow}
          </p>
          <h1 className="text-4xl font-black tracking-[-0.05em]">
            {text.title}
          </h1>
          <p className="leading-6 text-muted-foreground">{text.description}</p>
        </div>
        <ProfileForm
          action={completeOnboarding}
          initialProfile={profile}
          locale={locale}
        />
        <div className="flex justify-center border-t border-border pt-6">
          <LanguageSwitcher locale={locale} returnTo="/onboarding" />
        </div>
      </div>
    </StandaloneShell>
  );
}
