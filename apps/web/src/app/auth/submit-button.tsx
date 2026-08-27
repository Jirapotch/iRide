"use client";

import { GoogleLogo } from "@phosphor-icons/react";
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
      variant="default"
    >
      <GoogleLogo aria-hidden size={22} weight="bold" />
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
