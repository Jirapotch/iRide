"use client";

import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "antd";
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
      block
      htmlType="submit"
      icon={<GoogleLogo aria-hidden size={22} weight="bold" />}
      loading={pending}
      size="large"
      type="primary"
    >
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
