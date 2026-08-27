import { describe, expect, it } from "vitest";

import { safeNextPath, safeReturnPath } from "./auth-redirect";

describe("safeNextPath", () => {
  it("accepts a clean local path", () => {
    expect(safeNextPath("/account?tab=session")).toBe(
      "/account?tab=session",
    );
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    "https://evil.example/account",
    "//evil.example/path",
    "/%2f%2fevil.example",
    "/account\\evil",
    "/account/%5cevil",
    "/account/%2500evil",
    "/account#secret",
    "/th/account",
    "/en/account",
    "/%74h/account",
    "/%65n/account",
    "/%E0%A4%A",
  ])("rejects an unsafe or legacy-locale redirect: %s", (value) => {
    expect(safeNextPath(value)).toBe("/account");
  });

  it("limits redirect length", () => {
    expect(safeNextPath(`/account/${"a".repeat(2_100)}`)).toBe("/account");
  });

  it("uses a root fallback for language switch returns", () => {
    expect(safeReturnPath("/login?next=%2Faccount")).toBe(
      "/login?next=%2Faccount",
    );
    expect(safeReturnPath("/en/account")).toBe("/");
    expect(safeReturnPath("https://evil.example/")).toBe("/");
  });
});
