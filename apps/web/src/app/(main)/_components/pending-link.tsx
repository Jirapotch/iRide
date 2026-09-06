"use client";

import Link, { useLinkStatus, type LinkProps } from "next/link";
import {
  useCallback,
  useRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

type PendingLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    readonly children: ReactNode;
  };

function PendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className="link-pending-indicator"
      data-pending={pending ? "true" : "false"}
    />
  );
}

export function PendingLink({
  children,
  onClick,
  target,
  ...props
}: PendingLinkProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const acknowledgedRef = useRef(false);
  const acknowledgedAtRef = useRef(0);
  const pendingHrefRef = useRef<string | null>(null);
  const recoveryTimerRef = useRef<number | null>(null);
  const clearAcknowledgement = useCallback(() => {
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    acknowledgedRef.current = false;
    for (const anchor of document.querySelectorAll<HTMLAnchorElement>(
      'a[aria-busy="true"]',
    )) {
      if (anchor.href !== pendingHrefRef.current) continue;
      anchor.removeAttribute("aria-busy");
      const indicator = anchor.querySelector<HTMLElement>(
        ".link-pending-indicator",
      );
      if (indicator) indicator.dataset.pending = "false";
    }
    pendingHrefRef.current = null;
  }, []);

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
    if (acknowledgedRef.current) {
      if (Date.now() - acknowledgedAtRef.current < 2_500) {
        event.preventDefault();
        return;
      }
      clearAcknowledgement();
    }
    if (event.currentTarget.href === window.location.href) return;

    acknowledgedRef.current = true;
    acknowledgedAtRef.current = Date.now();
    pendingHrefRef.current = event.currentTarget.href;
    event.currentTarget.setAttribute("aria-busy", "true");
    const indicator = event.currentTarget.querySelector<HTMLElement>(
      ".link-pending-indicator",
    );
    if (indicator) indicator.dataset.pending = "true";
    recoveryTimerRef.current = window.setTimeout(clearAcknowledgement, 2_500);
  }

  return (
    <Link {...props} onClick={handleClick} ref={anchorRef} target={target}>
      {children}
      <PendingIndicator />
    </Link>
  );
}
