import type { ReactNode } from "react";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";

import { AppShell } from "./_components/app-shell";

export default async function MainLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession().catch(() => null),
  ]);

  return (
    <AppShell authenticated={Boolean(session)} locale={locale}>
      {children}
    </AppShell>
  );
}
