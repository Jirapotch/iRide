import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { editProfile } from "../actions";
import { ProfileForm } from "../profile-form";

const copy = {
  th: {
    eyebrow: "โปรไฟล์",
    title: "แก้ไขโปรไฟล์",
    description: "ข้อมูลสาธารณะของคุณจะปรากฏตามการตั้งค่าการมองเห็น",
  },
  en: {
    eyebrow: "Profile",
    title: "Edit profile",
    description:
      "Your public information follows the visibility setting below.",
  },
} as const;

export default async function EditProfilePage() {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession(),
  ]);
  if (!session) redirect("/login?next=%2Fprofile%2Fedit");
  const profile = await getOwnProfile(session.accessToken);
  if (!profile.isComplete) redirect("/onboarding");
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
          action={editProfile}
          initialProfile={profile}
          locale={locale}
        />
      </section>
    </main>
  );
}
