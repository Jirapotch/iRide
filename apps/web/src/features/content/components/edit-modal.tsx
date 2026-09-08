"use client";

import { X } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const subscribeToHydration = () => () => {};

export function EditModal({
  children,
  closeUrl,
  title,
}: {
  readonly children: ReactNode;
  readonly closeUrl: string;
  readonly title: string;
}) {
  const router = useRouter(),
    dialogRef = useRef<HTMLDivElement>(null),
    returnFocus = useRef<HTMLElement | null>(null),
    [dirty, setDirty] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const close = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    router.replace(closeUrl);
  }, [closeUrl, dirty, router]);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    returnFocus.current = document.activeElement as HTMLElement;
    const frame = requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLElement>("button,input,textarea,select")
        ?.focus(),
    );
    const key = (event: KeyboardEvent) => {
      if (document.querySelector(".maps-import-modal")) return;
      const dialog = dialogRef.current;
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab" && dialog) {
        const items = [
          ...dialog.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled])",
          ),
        ].filter((item) => item.getClientRects().length > 0);
        if (!items.length) return;
        const first = items[0]!,
          last = items.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      returnFocus.current?.focus();
    };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        aria-labelledby="edit-modal-title"
        aria-modal="true"
        className="edit-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <h2 id="edit-modal-title">{title}</h2>
          <button aria-label="Close" onClick={close} type="button">
            <X size={20} />
          </button>
        </header>
        <div onChange={() => setDirty(true)}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
