import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getRequestLocale } from "@/lib/request-locale";

import "./globals.css";

export const metadata: Metadata = {
  title: "iRide",
  description: "The community for every drive.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
