"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SectionError({
  message,
  retryLabel,
  title,
}: {
  readonly message: string;
  readonly retryLabel: string;
  readonly title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section className="section-error" role="alert">
      <WarningCircle aria-hidden="true" size={20} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button
        aria-busy={pending || undefined}
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        type="button"
      >
        {retryLabel}
      </button>
    </section>
  );
}
