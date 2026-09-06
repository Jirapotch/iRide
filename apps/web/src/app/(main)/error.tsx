"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PendingLink } from "./_components/pending-link";

const subscribeToLocale = () => () => undefined;
const readClientLocale = () => document.documentElement.lang === "th";
const readServerLocale = () => false;

export default function MainError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const thai = useSyncExternalStore(
    subscribeToLocale,
    readClientLocale,
    readServerLocale,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="route-error premium-card" role="alert">
      <h1 data-route-heading tabIndex={-1}>
        {thai ? "ไม่สามารถโหลดหน้านี้ได้" : "This page could not load"}
      </h1>
      <p>
        {thai
          ? "เมนูนำทางยังใช้งานได้ ลองโหลดหน้านี้อีกครั้งหรือกลับหน้าหลัก"
          : "Your navigation is still available. Retry this page or return home."}
      </p>
      <div className="route-error-actions">
        <button className="primary-action" onClick={reset} type="button">
          {thai ? "ลองอีกครั้ง" : "Retry"}
        </button>
        <PendingLink href="/">
          {thai ? "กลับหน้าหลัก" : "Back home"}
        </PendingLink>
      </div>
    </section>
  );
}
