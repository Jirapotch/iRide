"use client";

import {
  Moon,
  SignIn,
  SlidersHorizontal,
  Sun,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import { Button, Drawer } from "antd";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NavigationLinks } from "@/features/navigation/components/navigation-links";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { navigationLabels } from "@/features/navigation/navigation-copy";
import type { Locale } from "@/lib/locale";
import { NotificationPopover } from "@/features/notifications/components/notification-popover";
import { useTheme } from "@/app/_components/theme-provider";
import { SignOutButton } from "@/app/auth/sign-out-button";
import { setLocale } from "@/app/locale-actions";

export function HeaderActions({
  authenticated,
  locale,
  username,
  canManage,
}: {
  readonly authenticated: boolean;
  readonly locale: Locale;
  readonly username: string | null;
  readonly canManage: boolean;
}) {
  const text = navigationLabels[locale];
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  return (
    <>
      <nav
        className="desktop-nav"
        aria-label={locale === "th" ? "เมนูหลัก" : "Primary navigation"}
      >
        <NavigationLinks
          locale={locale}
          pathname={pathname}
          username={username}
        />
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
      <Drawer
        aria-label={text.settings}
        className="settings-drawer"
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        placement="right"
        size="default"
        title={
          <div>
            <p className="premium-kicker">iRide</p>
            <strong>{text.settings}</strong>
          </div>
        }
      >
        <div className="drawer-content">
          <section>
            <p className="drawer-label">{text.theme}</p>
            <div className="theme-options" role="group" aria-label={text.theme}>
              <Button
                aria-pressed={theme === "light"}
                icon={<Sun size={18} />}
                onClick={() => setTheme("light")}
              >
                {text.light}
              </Button>
              <Button
                aria-pressed={theme === "dark"}
                icon={<Moon size={18} />}
                onClick={() => setTheme("dark")}
              >
                {text.dark}
              </Button>
            </div>
          </section>
          {canManage ? (
            <section>
              <p className="drawer-label">Admin</p>
              <PendingLink
                className="drawer-row"
                href="/settings/users"
                onClick={() => setDrawerOpen(false)}
              >
                <span>
                  <UsersThree size={20} />
                  {text.manageUsers}
                </span>
              </PendingLink>
            </section>
          ) : null}
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
                  {locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
                </strong>
              </button>
            </form>
          </section>
          <section>
            <p className="drawer-label">{text.profile}</p>
            {authenticated ? (
              <>
                <PendingLink
                  className="drawer-row"
                  href={username ? `/users/${username}` : "/onboarding"}
                >
                  <span>
                    <UserCircle size={20} />
                    {text.profile}
                  </span>
                </PendingLink>
                <SignOutButton label={text.logout} />
              </>
            ) : (
              <PendingLink className="drawer-row" href="/login?intent=profile">
                <span>
                  <SignIn size={20} />
                  {text.login}
                </span>
              </PendingLink>
            )}
          </section>
        </div>
      </Drawer>
    </>
  );
}
