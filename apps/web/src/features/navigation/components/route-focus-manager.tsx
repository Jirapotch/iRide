"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  resolveNavigationFocusTarget,
  type NavigationFocusTarget,
} from "../navigation-location";

const targetSelectors: Record<NavigationFocusTarget, string> = {
  "route-heading": "#main-content [data-route-heading]",
  "profile-panel":
    '#main-content [data-navigation-focus-target="profile-panel"]',
  "admin-results":
    '#main-content [data-navigation-focus-target="admin-results"]',
  "create-form": '#main-content [data-navigation-focus-target="create-form"]',
};

export function RouteFocusManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const location = `${pathname}${search ? `?${search}` : ""}`;
  const previousLocation = useRef(location);

  useEffect(() => {
    if (previousLocation.current === location) return;

    const previous = new URL(previousLocation.current, window.location.origin);
    const current = new URL(location, window.location.origin);
    previousLocation.current = location;
    const target = resolveNavigationFocusTarget(previous, current);
    if (!target) return;

    let observer: MutationObserver | undefined;
    let timeout: number | undefined;
    const focusTarget = () => {
      const element = document.querySelector<HTMLElement>(
        targetSelectors[target],
      );
      if (!element) return false;
      element.focus({ preventScroll: true });
      observer?.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
      return true;
    };
    const frame = window.requestAnimationFrame(() => {
      if (focusTarget()) return;
      const main = document.getElementById("main-content");
      if (!main) return;
      observer = new MutationObserver(focusTarget);
      observer.observe(main, { childList: true, subtree: true });
      timeout = window.setTimeout(() => observer?.disconnect(), 2_000);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [location]);

  return null;
}
