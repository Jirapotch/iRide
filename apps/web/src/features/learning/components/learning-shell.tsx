import type { ReactNode } from "react";

import { BrandMark } from "@/app/_components/brand-mark";
import { PendingLink } from "@/features/navigation/components/pending-link";
import type { Locale } from "@/lib/locale";

import styles from "./learning.module.css";

export function LearningShell({
  children,
  locale,
}: {
  readonly children: ReactNode;
  readonly locale: Locale;
}) {
  return (
    <div className={styles.shell} data-ui="learning-shell">
      <a className="skip-link" href="#learning-content">
        {locale === "th" ? "ข้ามไปยังเนื้อหา" : "Skip to content"}
      </a>
      <header className={styles.siteHeader}>
        <PendingLink aria-label="iRide home" className={styles.brand} href="/">
          <BrandMark />
        </PendingLink>
        <nav aria-label={locale === "th" ? "สื่อความรู้" : "Learning"}>
          <PendingLink href="/learning">
            {locale === "th" ? "สื่อความรู้" : "Learning"}
          </PendingLink>
          <PendingLink href="/">
            {locale === "th" ? "หน้าหลัก" : "Home"}
          </PendingLink>
        </nav>
      </header>
      <main id="learning-content">{children}</main>
    </div>
  );
}
