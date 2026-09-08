import { describe, expect, it } from "vitest";

import { mapRoutePointCamera } from "./map-motion";

describe("mapRoutePointCamera", () => {
  it("centers the selected route point at zoom 13 with sheet-aware padding", () => {
    expect(
      mapRoutePointCamera(
        { latitude: 18.53563, longitude: 98.52212 },
        { width: 1280, height: 900 },
        false,
      ),
    ).toEqual({
      center: [98.52212, 18.53563],
      zoom: 13,
      duration: 420,
      essential: false,
      padding: { top: 80, right: 420, bottom: 80, left: 80 },
    });
  });

  it("moves immediately when reduced motion is enabled", () => {
    expect(
      mapRoutePointCamera(
        { latitude: 13.75, longitude: 100.5 },
        { width: 390, height: 844 },
        true,
      ).duration,
    ).toBe(0);
  });
});
