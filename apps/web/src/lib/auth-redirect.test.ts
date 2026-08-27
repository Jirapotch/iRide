import { describe, expect, it } from "vitest";

import { safeNextPath } from "./auth-redirect";

describe("safeNextPath", () => {
  it("accepts a clean path in the active locale", () => {
    expect(safeNextPath("/th/account?tab=session", "th")).toBe(
      "/th/account?tab=session",
    );
    expect(safeNextPath("/en", "en")).toBe("/en");
  });

  it.each([
    "https://evil.example/th/account",
    "//evil.example/path",
    "/%2f%2fevil.example",
    "/th\\evil",
    "/th/%5cevil",
    "/th/%2500evil",
    "/th/account#secret",
    "/en/account",
    "/tha/account",
    "/%E0%A4%A",
  ])("rejects an unsafe or cross-locale redirect: %s", (value) => {
    expect(safeNextPath(value, "th")).toBe("/th/account");
  });

  it("limits redirect length", () => {
    expect(safeNextPath(`/th/${"a".repeat(2_100)}`, "th")).toBe(
      "/th/account",
    );
  });
});
