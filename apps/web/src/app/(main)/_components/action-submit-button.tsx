"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function ActionSubmitButton({ children, pendingLabel }: { readonly children: ReactNode; readonly pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button aria-busy={pending} className="primary-action" disabled={pending} type="submit">
    {pending ? <><CircleNotch className="button-spinner" size={17}/>{pendingLabel}</> : children}
  </button>;
}
