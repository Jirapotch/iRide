import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  ProfileTabView,
  createProfileTabState,
  profileTabReducer,
  shouldHandleProfileTabClick,
} from "./profile-tab-controller";

function renderTabView(
  state: ReturnType<typeof createProfileTabState>,
  tabContent = <p>Committed server panel</p>,
) {
  return renderToStaticMarkup(
    <ProfileTabView
      locale="en"
      onSelect={() => undefined}
      overviewContent={<p>Overview panel</p>}
      state={state}
      tabContent={tabContent}
      username="river_rider"
    />,
  );
}

describe("profile tab controller", () => {
  test("selecting garage immediately updates aria-current and hides stale content behind a busy skeleton", () => {
    const state = profileTabReducer(createProfileTabState("overview"), {
      tab: "garage",
      type: "select",
    });

    const markup = renderTabView(state);

    expect(markup).toMatch(
      /<a(?=[^>]*data-profile-tab="garage")(?=[^>]*aria-current="page")[^>]*>/,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('data-ui="profile-tab-skeleton"');
    expect(markup).toContain('data-skeleton-tab="garage"');
    expect(markup).not.toContain("Overview panel");
    expect(markup).not.toContain("Committed server panel");
  });

  test("a server prop change synchronizes the selected tab and reveals its content", () => {
    const state = profileTabReducer(createProfileTabState("overview"), {
      tab: "activities",
      type: "server-committed",
    });

    const markup = renderTabView(state, <p>Latest activities</p>);

    expect(markup).toMatch(
      /<a(?=[^>]*data-profile-tab="activities")(?=[^>]*aria-current="page")[^>]*>/,
    );
    expect(markup).not.toContain('aria-busy="true"');
    expect(markup).not.toContain('data-ui="profile-tab-skeleton"');
    expect(markup).toContain("Latest activities");
  });

  test("returning to overview announces the overview loading state", () => {
    const state = profileTabReducer(createProfileTabState("activities"), {
      tab: "overview",
      type: "select",
    });

    const markup = renderTabView(state, <p>Stale activities</p>);

    expect(markup).toContain('aria-label="Loading overview"');
    expect(markup).not.toContain("Stale activities");
  });

  test("modified and non-primary clicks retain native Link behavior", () => {
    const plainClick = {
      altKey: false,
      button: 0,
      ctrlKey: false,
      hasDownload: false,
      metaKey: false,
      shiftKey: false,
      target: undefined,
    } as const;

    expect(shouldHandleProfileTabClick(plainClick)).toBe(true);
    expect(shouldHandleProfileTabClick({ ...plainClick, ctrlKey: true })).toBe(
      false,
    );
    expect(shouldHandleProfileTabClick({ ...plainClick, metaKey: true })).toBe(
      false,
    );
    expect(shouldHandleProfileTabClick({ ...plainClick, shiftKey: true })).toBe(
      false,
    );
    expect(shouldHandleProfileTabClick({ ...plainClick, altKey: true })).toBe(
      false,
    );
    expect(shouldHandleProfileTabClick({ ...plainClick, button: 1 })).toBe(
      false,
    );
    expect(
      shouldHandleProfileTabClick({ ...plainClick, target: "_blank" }),
    ).toBe(false);
    expect(
      shouldHandleProfileTabClick({ ...plainClick, hasDownload: true }),
    ).toBe(false);
  });

  test("the latest rapid click wins over an earlier server commit", () => {
    let state = createProfileTabState("overview");
    state = profileTabReducer(state, { tab: "garage", type: "select" });
    state = profileTabReducer(state, { tab: "activities", type: "select" });
    state = profileTabReducer(state, {
      tab: "garage",
      type: "server-committed",
    });

    let markup = renderTabView(state, <p>Stale garage</p>);
    expect(markup).toMatch(
      /<a(?=[^>]*data-profile-tab="activities")(?=[^>]*aria-current="page")[^>]*>/,
    );
    expect(markup).toContain('data-skeleton-tab="activities"');
    expect(markup).not.toContain("Stale garage");

    state = profileTabReducer(state, {
      tab: "activities",
      type: "server-committed",
    });
    markup = renderTabView(state, <p>Latest activities</p>);
    expect(markup).not.toContain('data-ui="profile-tab-skeleton"');
    expect(markup).toContain("Latest activities");
  });
});
