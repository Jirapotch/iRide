"use client";

import { useRouter } from "next/navigation";

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

  return (
    <button
      className="history-back-button"
      onClick={() => {
        const cameFromList =
          window.sessionStorage.getItem(originKey) === fallbackHref;
        if (cameFromList) {
          window.sessionStorage.removeItem(originKey);
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
