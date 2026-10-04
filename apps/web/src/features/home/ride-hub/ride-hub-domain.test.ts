import { describe, expect, it } from "vitest";
import {
  featureHref,
  gestureIntent,
  renderPolicy,
  visibleFeature,
} from "./ride-hub-domain";

describe("ride hub navigation and input policy", () => {
  it("opens real destinations and filters trips without inventing a route", () => {
    expect(featureHref("trips")).toBe("/activities?kinds=trip");
    expect(featureHref("routes")).toBe("/maps");
    expect(featureHref("community")).toBe("/community");
    expect(featureHref("knowledge")).toBe("/knowledge");
  });
  it("keeps vertical embedded touch gestures available to the page", () => {
    expect(gestureIntent(5, 30, true)).toBe("scroll");
    expect(gestureIntent(30, 5, true)).toBe("rotate");
    expect(gestureIntent(2, 3, true)).toBe("tap");
    expect(gestureIntent(5, 30, false)).toBe("rotate");
  });
  it("does not consume GPU when hidden and renders reduced motion on demand", () => {
    expect(
      renderPolicy({ visible: false, inView: true, reducedMotion: false }),
    ).toBe("pause");
    expect(
      renderPolicy({ visible: true, inView: false, reducedMotion: false }),
    ).toBe("pause");
    expect(
      renderPolicy({ visible: true, inView: true, reducedMotion: true }),
    ).toBe("demand");
  });
  it("validates feature selection instead of navigating arbitrary scene IDs", () => {
    expect(visibleFeature("trips")).toBe("trips");
    expect(visibleFeature("javascript:alert(1)")).toBeNull();
  });
});
