"use client";

import { DotsThreeVertical, NotePencil, Trash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { ActionSubmitButton } from "@/features/content/components/action-submit-button";
import { PendingLink } from "@/features/navigation/components/pending-link";
import type { Locale } from "@/lib/locale";

export function OwnerActionMenu({
  confirmText,
  deleteAction,
  editHref,
  hidden,
  locale,
}: {
  readonly confirmText: string;
  readonly deleteAction: (data: FormData) => void | Promise<void>;
  readonly editHref: string;
  readonly hidden: Readonly<Record<string, string>>;
  readonly locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div
      className="owner-action-menu"
      onClick={(event) => event.stopPropagation()}
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={locale === "th" ? "จัดการรายการ" : "Manage item"}
        className="owner-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        <DotsThreeVertical size={20} weight="bold" />
      </button>
      {open ? (
        <div className="owner-menu-popover" role="menu">
          <PendingLink
            href={editHref}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <NotePencil size={16} />
            {locale === "th" ? "แก้ไข" : "Edit"}
          </PendingLink>
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!confirm(confirmText)) event.preventDefault();
            }}
          >
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} name={name} type="hidden" value={value} />
            ))}
            <ActionSubmitButton
              ariaLabel={locale === "th" ? "ลบ" : "Delete"}
              className=""
              pendingLabel={locale === "th" ? "กำลังลบ…" : "Deleting…"}
              role="menuitem"
            >
              <Trash size={16} />
              {locale === "th" ? "ลบ" : "Delete"}
            </ActionSubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
