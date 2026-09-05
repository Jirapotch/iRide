import { describe, expect, it } from "vitest";

import { mapSelectionCamera } from "./map-motion";

const feature = { longitude: 100.5018, latitude: 13.7563 };

describe("map selection camera", () => {
  it("reserves the desktop side panel without hiding the selected point", () => {
    expect(
      mapSelectionCamera(feature, { width: 1280, height: 900 }, false),
    ).toEqual({
      center: [100.5018, 13.7563],
      duration: 420,
      essential: false,
      padding: { top: 80, right: 420, bottom: 80, left: 80 },
    });
  });

  it("reserves the mobile bottom sheet while keeping map context", () => {
    expect(
      mapSelectionCamera(feature, { width: 390, height: 844 }, false),
    ).toEqual({
      center: [100.5018, 13.7563],
      duration: 420,
      essential: false,
      padding: { top: 72, right: 24, bottom: 380, left: 24 },
    });
  });

  it("makes camera movement instant when reduced motion is requested", () => {
    expect(
      mapSelectionCamera(feature, { width: 1280, height: 900 }, true)
        .duration,
    ).toBe(0);
  });
});
