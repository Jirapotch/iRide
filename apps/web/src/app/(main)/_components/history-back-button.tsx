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
          router.back();
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
