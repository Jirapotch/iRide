import { theme, type ThemeConfig } from "antd";

export const matchaPalette = {
  primary: "#6F8F72",
  deep: "#4F6F52",
  softMint: "#BFD8C2",
  paleMint: "#E7F0E6",
  latte: "#D9DFC7",
  cream: "#F6F3E8",
  warmWhite: "#FBFAF5",
  warmGray: "#8B8E84",
  ink: "#27322A",
} as const;

export const motionTokens = {
  fast: 0.16,
  base: 0.28,
  slow: 0.45,
  offsetSmall: 8,
  offsetMedium: 16,
  offsetLarge: 24,
} as const;

const sharedTokens = {
  colorPrimary: matchaPalette.primary,
  colorBgBase: matchaPalette.cream,
  colorBgContainer: matchaPalette.warmWhite,
  colorTextBase: matchaPalette.ink,
  colorBorder: "#DBE2DA",
  borderRadius: 12,
  borderRadiusLG: 16,
  controlHeight: 44,
  fontFamily: "var(--font-geist), var(--font-noto-thai), sans-serif",
};

export function createThemeConfig(mode: "light" | "dark"): ThemeConfig {
  return mode === "dark"
    ? {
        algorithm: theme.darkAlgorithm,
        token: {
          ...sharedTokens,
          colorPrimary: matchaPalette.softMint,
          colorBgBase: "#18231E",
          colorBgContainer: "#213029",
          colorTextBase: "#EDF3EA",
          colorBorder: "rgba(184, 211, 195, 0.18)",
        },
      }
    : { algorithm: theme.defaultAlgorithm, token: sharedTokens };
}
