import { describe, expect, it } from "vitest";
import { initials, resolveAvatarUrl } from "@/lib/profile-utils";

describe("profile avatar mapping", () => {
  it("prefers iRide storage and accepts only Google CDN fallback", () => {
    expect(resolveAvatarUrl("https://storage/avatar.jpg", "https://lh3.googleusercontent.com/a/photo")).toBe("https://storage/avatar.jpg");
    expect(resolveAvatarUrl(null, "https://lh3.googleusercontent.com/a/photo")).toBe("https://lh3.googleusercontent.com/a/photo");
    expect(resolveAvatarUrl(null, "https://evil.example/avatar.jpg")).toBeNull();
  });

  it("creates stable initials", () => {
    expect(initials("Narin Drives")).toBe("ND");
    expect(initials(" ")).toBe("IR");
  });
});
