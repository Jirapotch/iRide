import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { getRequestLocale } from "@/lib/request-locale";
export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader locale={await getRequestLocale()} />
      {children}
    </>
  );
}
