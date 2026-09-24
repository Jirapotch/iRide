import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { BrandMark } from "@/app/_components/brand-mark";
import { PendingLink } from "@/features/navigation/components/pending-link";
import type { Locale } from "@/lib/locale";

import styles from "./knowledge.module.css";

export function KnowledgeShell({
  children,
  locale,
  section = "index",
}: {
  readonly children: ReactNode;
  readonly locale: Locale;
  readonly section?: "index" | "simulator";
}) {
  const backHref = section === "simulator" ? "/knowledge" : "/";
  const backLabel =
    section === "simulator"
      ? locale === "th"
        ? "กลับสู่สื่อความรู้ทั้งหมด"
        : "Back to all knowledge"
      : locale === "th"
        ? "กลับหน้าหลัก"
        : "Back home";
  return (
    <div className={styles.shell} data-ui="knowledge-shell">
      <a className="skip-link" href="#knowledge-content">
        {locale === "th" ? "ข้ามไปยังเนื้อหา" : "Skip to content"}
      </a>
      <header className={styles.siteHeader}>
        <PendingLink aria-label="iRide home" className={styles.brand} href="/">
          <BrandMark />
        </PendingLink>
        <PendingLink className={styles.headerBack} href={backHref}>
          <ArrowLeftIcon aria-hidden size={18} /> {backLabel}
        </PendingLink>
      </header>
      <main id="knowledge-content">{children}</main>
    </div>
  );
}
