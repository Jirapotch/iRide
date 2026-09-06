"use client";

import Link, { useLinkStatus, type LinkProps } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

type PendingLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    readonly children: ReactNode;
  };

function PendingIndicator({
  acknowledged,
}: {
  readonly acknowledged: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className="link-pending-indicator"
      data-pending={pending || acknowledged ? "true" : "false"}
    />
  );
}

export function PendingLink({
  children,
  onClick,
  target,
  ...props
}: PendingLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const [acknowledgedLocation, setAcknowledgedLocation] = useState<
    string | null
  >(null);
  const acknowledged = acknowledgedLocation === locationKey;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const plainSameTabClick =
      event.button === 0 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      target !== "_blank" &&
      !event.currentTarget.hasAttribute("download");
    if (!plainSameTabClick) return;
    if (acknowledged) {
      event.preventDefault();
      return;
    }
    if (event.currentTarget.href === window.location.href) return;

    setAcknowledgedLocation(locationKey);
  }

  return (
    <Link
      {...props}
      aria-busy={acknowledged || undefined}
      onClick={handleClick}
      target={target}
    >
      {children}
      <PendingIndicator acknowledged={acknowledged} />
    </Link>
  );
}
