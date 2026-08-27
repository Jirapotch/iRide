import { buttonVariants } from "@iride/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getPublicProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

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
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-16">
      <article className="overflow-hidden rounded-3xl border bg-background shadow-xl shadow-primary/5">
        <div
          className="h-36 bg-gradient-to-br from-primary/80 via-primary/40 to-muted"
          aria-hidden="true"
        />
        <div className="space-y-6 p-6 sm:p-9">
          <div className="-mt-20 flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-background bg-primary text-2xl font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {text.profile}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
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
            <dl className="rounded-2xl bg-muted p-4 text-sm">
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
    </main>
  );
}
