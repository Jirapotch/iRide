import { theme, type ThemeConfig } from "antd";

const sharedTokens = {
  colorPrimary: "#568F70",
  colorBgBase: "#F5F3EA",
  colorBgContainer: "#FBFAF5",
  colorTextBase: "#18231E",
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
          colorBgBase: "#18231E",
          colorBgContainer: "#213029",
          colorTextBase: "#EDF3EA",
          colorBorder: "rgba(184, 211, 195, 0.18)",
        },
      }
    : { algorithm: theme.defaultAlgorithm, token: sharedTokens };
}
