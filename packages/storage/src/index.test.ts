import { describe, expect, it } from "vitest";

import { mediaObjectKey, variantSpecs } from "./index";

describe("media storage contracts", () => {
  it("creates collision-safe keys without trusting the filename", () => {
    const key = mediaObjectKey("10000000-0000-4000-8000-000000000001", "avatar", "../../secret.jpg", "20000000-0000-4000-8000-000000000001");
    expect(key).toBe("users/10000000-0000-4000-8000-000000000001/avatar/20000000-0000-4000-8000-000000000001/original");
    expect(key).not.toContain("secret.jpg");
  });

  it("uses bounded WebP variants for every purpose", () => {
    expect(variantSpecs.avatar).toEqual([
      { kind: "thumbnail", width: 256, height: 256, fit: "cover" },
      { kind: "preview", width: 512, height: 512, fit: "cover" },
    ]);
    expect(variantSpecs.cover[1]).toMatchObject({ kind: "preview", width: 1600, height: 534 });
  });
});
