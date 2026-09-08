import { Suspense, type ReactNode } from "react";

import { AppShellSkeleton } from "@/features/loading/components/page-skeletons";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { getOwnProfile } from "@/lib/profile-api";
import { getRequestLocale } from "@/lib/request-locale";

import { AppShell } from "./_components/app-shell";

export default function MainLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <ResolvedMainLayout>{children}</ResolvedMainLayout>
    </Suspense>
  );
}

async function ResolvedMainLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
  ]);
  const profile = session
    ? await getOwnProfile(session.accessToken).catch(() => null)
    : null;

  return (
    <AppShell
      authenticated={Boolean(session)}
      canManage={profile?.canManage ?? false}
      locale={locale}
      username={profile?.username ?? null}
    >
      {children}
    </AppShell>
  );
}
