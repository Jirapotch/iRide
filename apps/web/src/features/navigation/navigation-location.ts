export type NavigationFocusTarget =
  "route-heading" | "profile-panel" | "admin-results" | "create-form";

export function resolveNavigationFocusTarget(
  previous: URL,
  current: URL,
): NavigationFocusTarget | null {
  if (previous.pathname !== current.pathname) return "route-heading";

  if (
    /^\/users\/[^/]+$/.test(current.pathname) &&
    previous.searchParams.get("tab") !== current.searchParams.get("tab")
  ) {
    return "profile-panel";
  }

  if (
    current.pathname === "/settings/users" &&
    (previous.searchParams.get("q") !== current.searchParams.get("q") ||
      previous.searchParams.get("page") !== current.searchParams.get("page"))
  ) {
    return "admin-results";
  }

  if (
    current.pathname === "/create" &&
    previous.searchParams.get("type") !== current.searchParams.get("type")
  ) {
    return "create-form";
  }

  return null;
}

export function isNavigationHrefActive(
  pathname: string,
  href: string,
  profile = false,
): boolean {
  if (href === "/") return pathname === "/";
  if (profile) return pathname.startsWith("/users/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
