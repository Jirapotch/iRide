"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function RouteFocusManager() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    let observer: MutationObserver | undefined;
    const focusHeading = () => {
      const heading = document.querySelector<HTMLElement>(
        "#main-content [data-route-heading]",
      );
      if (!heading) return false;
      heading.focus({ preventScroll: true });
      observer?.disconnect();
      return true;
    };
    const frame = window.requestAnimationFrame(() => {
      if (focusHeading()) return;
      const main = document.getElementById("main-content");
      if (!main) return;
      observer = new MutationObserver(focusHeading);
      observer.observe(main, { childList: true, subtree: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
