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
        className="grid size-6 place-items-center rounded-full bg-white font-semibold text-blue-600 shadow-sm"
      >
        G
      </span>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
