import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { AppShell } from "../../(main)/_components/app-shell";
import { PageIntro } from "../../(main)/_components/page-intro";
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
    <AppShell authenticated locale={locale}>
      <div className="space-y-8">
        <PageIntro
          description={text.description}
          eyebrow={text.eyebrow}
          title={text.title}
        />
        <section className="max-w-2xl rounded-[2rem] border border-border bg-surface p-6 sm:p-9">
          <ProfileForm
            action={editProfile}
            initialProfile={profile}
            locale={locale}
          />
        </section>
      </div>
    </AppShell>
  );
}
