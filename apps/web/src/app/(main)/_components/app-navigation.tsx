"use client";

import {
  Bell,
  Compass,
  MagnifyingGlass,
  Moon,
  Plus,
  SignIn,
  SlidersHorizontal,
  Sun,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/lib/locale";
import { notifications } from "@/lib/mock-content";
import { useMockApp } from "./mock-app-provider";
import { useTheme } from "../../_components/theme-provider";
import { SignOutButton } from "../../auth/sign-out-button";
import { setLocale } from "../../locale-actions";

const labels = {
  th: {
    discover: "ค้นพบ",
    search: "ค้นหา",
    create: "สร้าง",
    community: "ชุมชน",
    profile: "โปรไฟล์",
    notifications: "แจ้งเตือน",
    menu: "ตั้งค่า",
    close: "ปิด",
    settings: "การตั้งค่า",
    language: "ภาษา",
    theme: "ธีม",
    light: "สว่าง",
    dark: "มืด",
    login: "เข้าสู่ระบบ",
    logout: "ออกจากระบบ",
  },
  en: {
    discover: "Discover",
    search: "Search",
    create: "Create",
    community: "Community",
    profile: "Profile",
    notifications: "Notifications",
    menu: "Settings",
    close: "Close",
    settings: "Settings",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    login: "Sign in",
    logout: "Sign out",
  },
} as const;

export function HeaderActions({
  authenticated,
  locale,
  username,
}: {
  readonly authenticated: boolean;
  readonly locale: Locale;
  readonly username: string | null;
}) {
  const text = labels[locale];
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  return (
    <>
      <nav
        className="desktop-nav"
        aria-label={locale === "th" ? "เมนูหลัก" : "Primary navigation"}
      >
        {navigationFor(username).map((item) => (
          <NavLink
            item={item}
            locale={locale}
            pathname={pathname}
            key={item.key}
          />
        ))}
      </nav>
      <div className="header-actions">
        <NotificationPopover locale={locale} />
        <button
          aria-expanded={drawerOpen}
          aria-label={text.menu}
          className="header-icon"
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>
      {drawerOpen ? (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawerOpen(false);
          }}
        >
          <aside
            className="settings-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={text.settings}
          >
            <header>
              <div>
                <p className="premium-kicker">iRide</p>
                <h2>{text.settings}</h2>
              </div>
              <button
                aria-label={text.close}
                className="header-icon"
                onClick={() => setDrawerOpen(false)}
                type="button"
              >
                <X size={21} />
              </button>
            </header>
            <div className="drawer-content">
              <section>
                <p className="drawer-label">{text.theme}</p>
                <div
                  className="theme-options"
                  role="group"
                  aria-label={text.theme}
                >
                  <button
                    aria-pressed={theme === "light"}
                    onClick={() => setTheme("light")}
                    type="button"
                  >
                    <Sun size={19} />
                    {text.light}
                  </button>
                  <button
                    aria-pressed={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    type="button"
                  >
                    <Moon size={19} />
                    {text.dark}
                  </button>
                </div>
              </section>
              <section>
                <p className="drawer-label">{text.language}</p>
                <form action={setLocale}>
                  <input
                    name="locale"
                    type="hidden"
                    value={locale === "th" ? "en" : "th"}
                  />
                  <input name="returnTo" type="hidden" value={pathname} />
                  <button className="drawer-row" type="submit">
                    <span>{locale === "th" ? "ภาษาไทย" : "English"}</span>
                    <strong>
                      {locale === "th"
                        ? "Switch to English"
                        : "เปลี่ยนเป็นภาษาไทย"}
                    </strong>
                  </button>
                </form>
              </section>
              <section>
                <p className="drawer-label">{text.profile}</p>
                {authenticated ? (
                  <>
                    <Link
                      className="drawer-row"
                      href={username ? `/users/${username}` : "/onboarding"}
                    >
                      <span>
                        <UserCircle size={20} />
                        {text.profile}
                      </span>
                    </Link>
                    <SignOutButton label={text.logout} />
                  </>
                ) : (
                  <Link className="drawer-row" href="/login?intent=profile">
                    <span>
                      <SignIn size={20} />
                      {text.login}
                    </span>
                  </Link>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function NotificationPopover({ locale }: { readonly locale: Locale }) {
  const text = labels[locale],
    [open, setOpen] = useState(false),
    rootRef = useRef<HTMLDivElement>(null),
    buttonRef = useRef<HTMLButtonElement>(null),
    { state, dispatch } = useMockApp(),
    unread = notifications.filter(
      (item) => !state.readNotificationIds.includes(item.id),
    );
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
    <div className="notification-popover-root" ref={rootRef}>
      <button
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
          <Link href="/notifications" onClick={() => setOpen(false)}>
            {locale === "th" ? "ดูหน้าแจ้งเตือน" : "Open notifications page"}
          </Link>
        </section>
      ) : null}
    </div>
  );
}

export function BottomNavigation({
  locale,
  username,
}: {
  readonly locale: Locale;
  readonly username: string | null;
}) {
  const pathname = usePathname();
  return (
    <nav
      className="bottom-nav"
      aria-label={locale === "th" ? "เมนูหลัก" : "Primary navigation"}
    >
      {navigationFor(username).map((item) => (
        <NavLink
          item={item}
          locale={locale}
          pathname={pathname}
          key={item.key}
        />
      ))}
    </nav>
  );
}

function navigationFor(username: string | null) {
  return [
    { href: "/", key: "discover" as const, icon: Compass },
    { href: "/search", key: "search" as const, icon: MagnifyingGlass },
    { href: "/create", key: "create" as const, icon: Plus, create: true },
    { href: "/community", key: "community" as const, icon: UsersThree },
    {
      href: username ? `/users/${username}` : "/login?intent=profile",
      key: "profile" as const,
      icon: UserCircle,
      profile: true,
    },
  ];
}
type NavigationItem = ReturnType<typeof navigationFor>[number];
function NavLink({
  item,
  locale,
  pathname,
}: {
  readonly item: NavigationItem;
  readonly locale: Locale;
  readonly pathname: string;
}) {
  const isProfile = "profile" in item;
  const active =
    item.href === "/"
      ? pathname === "/"
      : isProfile
        ? pathname.startsWith("/users/")
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const isCreate = "create" in item;
  const label = labels[locale][item.key];
  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={isCreate ? label : undefined}
      className={`${isCreate ? "create-nav" : "nav-item"} ${active ? "is-active" : ""}`}
      href={item.href}
    >
      <span className={isCreate ? "create-orb" : "nav-icon"}>
        <Icon
          size={isCreate ? 25 : 21}
          weight={active || isCreate ? "bold" : "regular"}
        />
      </span>
      <span className={isCreate ? "sr-only" : undefined}>{label}</span>
    </Link>
  );
}
