import type { Metadata } from "next";
import { Geist, Noto_Sans_Thai } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { getRequestLocale } from "@/lib/request-locale";
import { StoreProvider } from "@/store/provider";
import { ThemeProvider } from "./_components/theme-provider";

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
        width: 1200,
        height: 630,
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

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-noto-thai",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geist.variable} ${notoThai.variable}`}>
        <Script id="iride-theme" strategy="beforeInteractive">{`
          try {
            var stored = localStorage.getItem('iride-theme');
            var theme = stored === 'light' || stored === 'dark'
              ? stored
              : 'light';
            document.documentElement.dataset.theme = theme;
            document.documentElement.style.colorScheme = theme;
          } catch (_) {}
        `}</Script>
        <AntdRegistry>
          <StoreProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </StoreProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
