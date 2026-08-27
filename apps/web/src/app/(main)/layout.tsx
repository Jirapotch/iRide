import type { ReactNode } from "react";

import { getRequestLocale } from "@/lib/request-locale";

import { AppShell } from "./_components/app-shell";

export default async function MainLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();

  return <AppShell locale={locale}>{children}</AppShell>;
}
