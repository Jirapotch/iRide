"use client";
import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
export function PendingLink(
  props: LinkProps &
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
      children: ReactNode;
    },
) {
  return <Link {...props} />;
}
