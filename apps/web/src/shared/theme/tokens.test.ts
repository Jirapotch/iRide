import { describe, expect, it } from "vitest";

import { createThemeConfig, matchaPalette, motionTokens } from "./tokens";

describe("Matcha design tokens", () => {
  it("exports the approved semantic palette for product consumers", () => {
    expect(matchaPalette).toMatchObject({
      primary: "#6F8F72",
      deep: "#4F6F52",
      cream: "#F6F3E8",
      ink: "#27322A",
    });
  });

  it("keeps shared interaction timing restrained", () => {
    expect(motionTokens).toEqual({
      fast: 0.16,
      base: 0.28,
      slow: 0.45,
      offsetSmall: 8,
      offsetMedium: 16,
      offsetLarge: 24,
    });
  });

  it("maps light and dark Ant Design surfaces to the product themes", () => {
    expect(createThemeConfig("light").token).toMatchObject({
      colorPrimary: "#6F8F72",
      colorBgBase: "#F6F3E8",
      colorTextBase: "#27322A",
    });
    expect(createThemeConfig("dark").token).toMatchObject({
      colorPrimary: "#BFD8C2",
      colorBgBase: "#18231E",
    });
  });
});
