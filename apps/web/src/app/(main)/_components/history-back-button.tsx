"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function HistoryBackButton({
  fallbackHref,
  label,
  originKey,
}: {
  readonly fallbackHref: string;
  readonly label: string;
  readonly originKey: string;
}) {
  const router = useRouter();
  const cameFromListRef = useRef(false);

  useEffect(() => {
    cameFromListRef.current =
      window.sessionStorage.getItem(originKey) === fallbackHref;
    window.sessionStorage.removeItem(originKey);
  }, [fallbackHref, originKey]);

  return (
    <button
      className="history-back-button"
      onClick={() => {
        if (cameFromListRef.current) {
          const scrollTop = Number(
            window.sessionStorage.getItem(
              `iride:admin-users-scroll:${fallbackHref}`,
            ) ?? "0",
          );
          router.back();
          if (Number.isFinite(scrollTop) && scrollTop > 0) {
            window.setTimeout(() => window.scrollTo(0, scrollTop), 180);
          }
        } else {
          router.push(fallbackHref);
        }
      }}
      type="button"
    >
      ← {label}
    </button>
  );
}
