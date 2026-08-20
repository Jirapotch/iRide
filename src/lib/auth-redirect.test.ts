import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth-redirect";

describe("safeNextPath", () => {
  it("accepts clean local paths and migrates legacy locale paths", () => {
    expect(safeNextPath("/profile/me?tab=garage")).toBe("/profile/me?tab=garage");
    expect(safeNextPath("/th/profile/me?tab=garage")).toBe("/profile/me?tab=garage");
    expect(safeNextPath("/en/post/1")).toBe("/post/1");
  });

  it("rejects external and malformed destinations", () => {
    expect(safeNextPath("https://evil.example")).toBe("/feed");
    expect(safeNextPath("//evil.example")).toBe("/feed");
    expect(safeNextPath("/feed\\u0000evil")).toBe("/feed");
  });
});
