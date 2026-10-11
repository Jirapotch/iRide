import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Providers } from "@/components/providers";
import { getRequestLocale } from "@/lib/request-locale";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "iRide — Your personal garage", template: "%s | iRide" },
  description: "Your garage, service history, engine lab and arcade.",
};
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale}>
      <body>
        <AntdRegistry>
          <Providers locale={locale}>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
