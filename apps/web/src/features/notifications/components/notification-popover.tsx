"use client";

import { Bell } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { PendingLink } from "@/features/navigation/components/pending-link";
import { navigationLabels } from "@/features/navigation/navigation-copy";
import type { Locale } from "@/lib/locale";
import { notifications } from "@/lib/notifications";

import { useMockApp } from "../mock-app-provider";

export function NotificationPopover({ locale }: { readonly locale: Locale }) {
  const text = navigationLabels[locale];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const { state, dispatch } = useMockApp();
  const unread = notifications.filter(
    (item) => !state.readNotificationIds.includes(item.id),
  );

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      popoverRef.current
        ?.querySelector<HTMLElement>(
          "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        )
        ?.focus({ preventScroll: true });
    });
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="notification-popover-root" ref={rootRef}>
      <button
        aria-controls="notification-popover"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={text.notifications}
        className="header-icon relative"
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        <Bell size={20} />
        {unread.length ? (
          <span className="notification-count">{unread.length}</span>
        ) : null}
      </button>
      {open ? (
        <section
          aria-label={text.notifications}
          className="notification-popover"
          id="notification-popover"
          ref={popoverRef}
          role="dialog"
        >
          <header>
            <div>
              <strong>{text.notifications}</strong>
              <small>
                {locale === "th"
                  ? `${unread.length} รายการใหม่`
                  : `${unread.length} new`}
              </small>
            </div>
            <button
              disabled={!unread.length}
              onClick={() =>
                dispatch({
                  type: "read-all-notifications",
                  notificationIds: notifications.map((item) => item.id),
                })
              }
              type="button"
            >
              {locale === "th" ? "อ่านทั้งหมด" : "Mark all read"}
            </button>
          </header>
          <div className="notification-popover-list">
            {notifications.map((item) => {
              const read = state.readNotificationIds.includes(item.id);
              return (
                <button
                  className={`notification-row ${read ? "is-read" : ""}`}
                  key={item.id}
                  onClick={() =>
                    dispatch({
                      type: "read-notification",
                      notificationId: item.id,
                    })
                  }
                  type="button"
                >
                  <span className="notification-icon">
                    <Bell size={18} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.detail} · {item.time}
                    </small>
                  </span>
                  {!read ? <i /> : null}
                </button>
              );
            })}
          </div>
          <PendingLink href="/notifications" onClick={() => setOpen(false)}>
            {locale === "th" ? "ดูหน้าแจ้งเตือน" : "Open notifications page"}
          </PendingLink>
        </section>
      ) : null}
    </div>
  );
}
