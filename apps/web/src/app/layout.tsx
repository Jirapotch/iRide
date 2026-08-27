import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getRequestLocale } from "@/lib/request-locale";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://iride-ecru.vercel.app"),
  title: "iRide",
  description: "One road. Endless stories. Join the community for every drive.",
  openGraph: {
    title: "iRide",
    description: "One road. Endless stories.",
    images: [
      {
        url: "/og.png",
        width: 1792,
        height: 938,
        alt: "iRide — One road. Endless stories.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iRide",
    description: "One road. Endless stories.",
    images: ["/og.png"],
  },
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
