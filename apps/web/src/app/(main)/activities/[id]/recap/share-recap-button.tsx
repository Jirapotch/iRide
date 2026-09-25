"use client";

import { useState } from "react";

export function ShareRecapButton({ locale }: { readonly locale: "th" | "en" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(window.location.href)
          .then(() => setCopied(true));
      }}
    >
      {copied
        ? locale === "th"
          ? "คัดลอกแล้ว"
          : "Copied"
        : locale === "th"
          ? "คัดลอกลิงก์"
          : "Copy link"}
    </button>
  );
}
