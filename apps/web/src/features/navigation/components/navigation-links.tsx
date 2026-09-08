import {
  House,
  MagnifyingGlass,
  MapTrifold,
  Plus,
  UserCircle,
} from "@phosphor-icons/react";

import { primaryNavigation } from "@/lib/app-navigation-domain";
import type { Locale } from "@/lib/locale";

import { isNavigationHrefActive } from "../navigation-location";
import { navigationLabels } from "../navigation-copy";
import { PendingLink } from "./pending-link";

export function NavigationLinks({
  locale,
  pathname,
  username,
}: {
  readonly locale: Locale;
  readonly pathname: string;
  readonly username: string | null;
}) {
  return navigationFor(username).map((item) => {
    const isProfile = "profile" in item;
    const active = isNavigationHrefActive(pathname, item.href, isProfile);
    const Icon = item.icon;
    const isCreate = "create" in item;
    const label = navigationLabels[locale][item.key];
    return (
      <PendingLink
        aria-current={active ? "page" : undefined}
        aria-label={isCreate ? label : undefined}
        className={`${isCreate ? "create-nav" : "nav-item"} ${active ? "is-active" : ""}`}
        href={item.href}
        key={item.key}
      >
        <span className={isCreate ? "create-orb" : "nav-icon"}>
          <Icon
            size={isCreate ? 25 : 21}
            weight={active || isCreate ? "bold" : "regular"}
          />
        </span>
        <span className={isCreate ? "sr-only" : undefined}>{label}</span>
      </PendingLink>
    );
  });
}

function navigationFor(username: string | null) {
  const icons = {
    home: House,
    maps: MapTrifold,
    create: Plus,
    search: MagnifyingGlass,
    profile: UserCircle,
  } as const;
  return primaryNavigation(username).map((item) => ({
    ...item,
    icon: icons[item.key],
    ...(item.key === "create" ? { create: true as const } : {}),
    ...(item.key === "profile" ? { profile: true as const } : {}),
  }));
}
