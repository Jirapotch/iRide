import Link from "next/link";

import type { BreadcrumbItem } from "@/lib/app-navigation-domain";

export function Breadcrumbs({
  items,
}: {
  readonly items: readonly BreadcrumbItem[];
}) {
  if (items.length < 2) return null;

  const parent = items.at(-2);

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumb-full">
        {items.map((item) => (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      {parent?.href ? (
        <Link
          aria-label={`Back to ${parent.label}`}
          className="breadcrumb-compact"
          href={parent.href}
        >
          ← {parent.label}
        </Link>
      ) : null}
    </nav>
  );
}
