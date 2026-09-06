"use client";

import Link, { useLinkStatus, type LinkProps } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

type PendingLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    readonly children: ReactNode;
  };

interface PendingNavigation {
  observed: boolean;
  timer: number | null;
}

const pendingNavigations = new Map<string, PendingNavigation>();
let committedLocation: string | null = null;

function PendingIndicator({
  acknowledged,
  onPendingChange,
}: {
  readonly acknowledged: boolean;
  readonly onPendingChange: (pending: boolean) => void;
}) {
  const { pending } = useLinkStatus();
  useLayoutEffect(() => onPendingChange(pending), [onPendingChange, pending]);

  return (
    <span
      aria-hidden="true"
      className="link-pending-indicator"
      data-link-pending={pending ? "true" : "false"}
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
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [acknowledgedLocation, setAcknowledgedLocation] = useState<
    string | null
  >(null);
  const acknowledged = acknowledgedLocation === locationKey;
  const clearAcknowledgement = useCallback((href: string) => {
    const navigation = pendingNavigations.get(href);
    if (navigation?.timer != null) window.clearTimeout(navigation.timer);
    pendingNavigations.delete(href);
    setAcknowledgedLocation(null);
  }, []);
  const handlePendingChange = useCallback(
    (pending: boolean) => {
      const href = anchorRef.current?.href;
      if (!href) return;
      const navigation = pendingNavigations.get(href);
      if (!navigation) return;
      if (pending) {
        navigation.observed = true;
        if (navigation.timer !== null) {
          window.clearTimeout(navigation.timer);
          navigation.timer = null;
        }
        return;
      }
      if (navigation.observed) clearAcknowledgement(href);
    },
    [clearAcknowledgement],
  );
  useEffect(() => {
    if (committedLocation === locationKey) return;
    committedLocation = locationKey;
    for (const navigation of pendingNavigations.values()) {
      if (navigation.timer !== null) window.clearTimeout(navigation.timer);
    }
    pendingNavigations.clear();
  }, [locationKey]);

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
    const href = event.currentTarget.href;
    if (pendingNavigations.has(href)) {
      event.preventDefault();
      return;
    }
    if (href === window.location.href) return;

    setAcknowledgedLocation(locationKey);
    const navigation: PendingNavigation = { observed: false, timer: null };
    navigation.timer = window.setTimeout(() => {
      if (!navigation.observed) clearAcknowledgement(href);
    }, 2_500);
    pendingNavigations.set(href, navigation);
  }

  return (
    <Link
      {...props}
      aria-busy={acknowledged || undefined}
      onClick={handleClick}
      ref={anchorRef}
      target={target}
    >
      {children}
      <PendingIndicator
        acknowledged={acknowledged}
        onPendingChange={handlePendingChange}
      />
    </Link>
  );
}
