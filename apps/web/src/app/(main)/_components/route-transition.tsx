"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function RouteTransition({
  children,
}: {
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="route-content" data-ui="route-content" key={pathname}>
      {children}
    </div>
  );
}
