"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

import type { Locale } from "@/lib/locale";
import styles from "./activities.module.css";

export function ActivitiesRetryPanel({ locale }: { readonly locale: Locale }) {
  const router = useRouter();
  return (
    <div className={styles.errorPanel} role="alert">
      <strong>
        {locale === "th" ? "โหลดกิจกรรมไม่ได้" : "Activities unavailable"}
      </strong>
      <p>{locale === "th" ? "กรุณาลองใหม่อีกครั้ง" : "Please try again."}</p>
      <button onClick={() => router.refresh()} type="button">
        <ArrowClockwise aria-hidden size={17} />
        {locale === "th" ? "ลองอีกครั้ง" : "Retry"}
      </button>
    </div>
  );
}
