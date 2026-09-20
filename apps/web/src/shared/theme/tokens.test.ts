import { describe, expect, it } from "vitest";

import {
  createThemeConfig,
  matchaPalette,
  motionTokens,
  signalPalette,
} from "./tokens";

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(a: string, b: string) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (left, right) => right - left,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

function rgbDistance(a: string, b: string) {
  const channels = (hex: string) =>
    hex
      .slice(1)
      .match(/.{2}/g)!
      .map((channel) => Number.parseInt(channel, 16));
  const [aRed, aGreen, aBlue] = channels(a);
  const [bRed, bGreen, bBlue] = channels(b);
  return Math.hypot(aRed! - bRed!, aGreen! - bGreen!, aBlue! - bBlue!);
}

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

  it("uses signal red as an accessible co-primary without replacing danger", () => {
    expect(signalPalette.brand).toBe("#EF3834");
    expect(
      contrastRatio(signalPalette.strong, "#FFFFFF"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(signalPalette.darkText, "#213029"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(createThemeConfig("light")).toMatchObject({
      token: { colorError: "#8B3158" },
      components: {
        Tabs: {
          inkBarColor: "#EF3834",
          itemSelectedColor: signalPalette.strong,
        },
      },
    });
    expect(createThemeConfig("dark")).toMatchObject({
      token: { colorError: "#FF9CBD" },
      components: {
        Tabs: {
          inkBarColor: "#EF3834",
          itemSelectedColor: signalPalette.darkText,
        },
      },
    });
    expect(rgbDistance(signalPalette.strong, "#8B3158")).toBeGreaterThan(60);
    expect(rgbDistance(signalPalette.darkText, "#FF9CBD")).toBeGreaterThan(35);
  });
});
