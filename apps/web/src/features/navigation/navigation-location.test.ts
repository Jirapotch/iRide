import { describe, expect, it } from "vitest";

import {
  isNavigationHrefActive,
  resolveNavigationFocusTarget,
} from "./navigation-location";

describe("resolveNavigationFocusTarget", () => {
  it("focuses the destination heading when the pathname changes", () => {
    expect(
      resolveNavigationFocusTarget(
        new URL("https://iride.test/"),
        new URL("https://iride.test/community"),
      ),
    ).toBe("route-heading");
  });

  it("focuses profile tab content when only the profile tab changes", () => {
    expect(
      resolveNavigationFocusTarget(
        new URL("https://iride.test/users/rider?tab=overview"),
        new URL("https://iride.test/users/rider?tab=garage"),
      ),
    ).toBe("profile-panel");
  });

  it("focuses admin results when search or pagination changes", () => {
    expect(
      resolveNavigationFocusTarget(
        new URL("https://iride.test/settings/users?q=rider&page=1"),
        new URL("https://iride.test/settings/users?q=locked&page=1"),
      ),
    ).toBe("admin-results");
  });

  it("focuses the create form when its content type changes", () => {
    expect(
      resolveNavigationFocusTarget(
        new URL("https://iride.test/create?type=post"),
        new URL("https://iride.test/create?type=event"),
      ),
    ).toBe("create-form");
  });

  it("leaves marker and modal query changes to the map owner", () => {
    expect(
      resolveNavigationFocusTarget(
        new URL("https://iride.test/maps"),
        new URL("https://iride.test/maps?marker=event-1&modal=edit"),
      ),
    ).toBeNull();
  });

  it("does not move focus for unrelated query changes", () => {
    expect(
      resolveNavigationFocusTarget(
        new URL("https://iride.test/community?source=home"),
        new URL("https://iride.test/community?source=search"),
      ),
    ).toBeNull();
  });
});

describe("isNavigationHrefActive", () => {
  it("matches home exactly", () => {
    expect(isNavigationHrefActive("/", "/")).toBe(true);
    expect(isNavigationHrefActive("/community", "/")).toBe(false);
  });

  it("matches a navigation section and its descendants", () => {
    expect(isNavigationHrefActive("/maps", "/maps")).toBe(true);
    expect(isNavigationHrefActive("/maps/events", "/maps")).toBe(true);
  });

  it("maps a signed-in profile destination to public profile routes", () => {
    expect(isNavigationHrefActive("/users/rider", "/users/rider", true)).toBe(
      true,
    );
    expect(
      isNavigationHrefActive("/users/another-rider", "/users/rider", true),
    ).toBe(true);
  });
});
