"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";
import type { AriaRole, ReactNode } from "react";

export function ActionSubmitButton({
  ariaLabel,
  children,
  className = "primary-action",
  pendingLabel,
  role,
}: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly pendingLabel: string;
  readonly role?: AriaRole;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      aria-label={ariaLabel}
      className={className}
      disabled={pending}
      role={role}
      type="submit"
    >
      {pending ? (
        <>
          <CircleNotch className="button-spinner" size={17} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
