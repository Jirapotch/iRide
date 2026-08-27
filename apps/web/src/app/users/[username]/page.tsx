import { buttonVariants } from "@iride/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getPublicProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { AppShell } from "../../(main)/_components/app-shell";

const copy = {
  th: {
    profile: "โปรไฟล์ผู้ขับขี่",
    location: "พื้นที่",
    edit: "แก้ไขโปรไฟล์",
    home: "กลับหน้าหลัก",
    emptyBio: "ยังไม่ได้เขียนคำแนะนำตัว",
  },
  en: {
    profile: "Rider profile",
    location: "Location",
    edit: "Edit profile",
    home: "Back home",
    emptyBio: "No bio yet.",
  },
} as const;

export default async function PublicProfilePage({
  params,
}: {
  readonly params: Promise<{ username: string }>;
}) {
  const [{ username }, locale, session] = await Promise.all([
    params,
    getRequestLocale(),
    getVerifiedWebSession(),
  ]);
  const profile = await getPublicProfile(username, session?.accessToken);
  if (!profile) notFound();
  const text = copy[locale];
  const isOwner = session?.userId === profile.id;
  const initials = profile.displayName.slice(0, 2).toUpperCase();

  return (
    <AppShell authenticated={Boolean(session)} locale={locale}>
      <article className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl shadow-black/25">
        <div
          className="relative h-44 overflow-hidden bg-gradient-to-br from-primary/75 via-primary/20 to-background"
          aria-hidden="true"
        >
          <span className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-primary/25" />
          <span className="absolute -right-4 -top-12 h-48 w-48 rounded-full border border-foreground/10" />
        </div>
        <div className="space-y-6 p-6 sm:p-9">
          <div className="-mt-24 flex h-28 w-28 items-center justify-center rounded-full border-4 border-surface bg-primary text-2xl font-black text-primary-foreground shadow-xl shadow-black/25">
            {initials}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              {text.profile}
            </p>
            <h1 className="text-4xl font-black tracking-[-0.05em]">
              {profile.displayName}
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              @{profile.username}
            </p>
          </div>
          <p className="leading-7 text-muted-foreground">
            {profile.bio ?? text.emptyBio}
          </p>
          {profile.locationName ? (
            <dl className="rounded-2xl border border-border bg-background/25 p-4 text-sm">
              <dt className="text-muted-foreground">{text.location}</dt>
              <dd className="mt-1 font-medium">{profile.locationName}</dd>
            </dl>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              {text.home}
            </Link>
            {isOwner ? (
              <Link className={buttonVariants()} href="/profile/edit">
                {text.edit}
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    </AppShell>
  );
}
