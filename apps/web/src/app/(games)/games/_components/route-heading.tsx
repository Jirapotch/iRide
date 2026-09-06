"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function RouteHeading({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h1 data-route-heading ref={ref} tabIndex={-1}>
      {children}
    </h1>
  );
}
