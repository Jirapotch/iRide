import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  localeFromAcceptLanguage,
  resolveLocale,
} from "./locale";

describe("request locale resolution", () => {
  it("prefers a valid locale cookie", () => {
    expect(resolveLocale("th", "en-US,en;q=0.9")).toBe("th");
    expect(resolveLocale("en", "th-TH,th;q=0.9")).toBe("en");
  });

  it("matches supported base languages by quality", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,th;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("en;q=0.5,th-TH;q=0.9")).toBe("th");
    expect(localeFromAcceptLanguage("en;q=0,th;q=0.5")).toBe("th");
  });

  it("falls back to Thai for missing, invalid, or unsupported preferences", () => {
    expect(resolveLocale("invalid", "ja-JP,ja;q=0.9")).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage("en;q=invalid")).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage("en;q=2")).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
  });
});
