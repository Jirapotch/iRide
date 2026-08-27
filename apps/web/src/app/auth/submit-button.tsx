"use client";

import { Button } from "@iride/ui/button";
import { useFormStatus } from "react-dom";

export function AuthSubmitButton({
  idleLabel,
  pendingLabel,
}: {
  readonly idleLabel: string;
  readonly pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      className="h-12 w-full gap-3 text-base"
      disabled={pending}
      type="submit"
      variant="outline"
    >
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-full border border-primary/25 bg-primary/[0.06] font-black text-primary"
      >
        G
      </span>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
