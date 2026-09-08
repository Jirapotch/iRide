import { describe, expect, it } from "vitest";

import { shouldExpandFeatureForFocus } from "./feature-interaction";

describe("shouldExpandFeatureForFocus", () => {
  it("expands a feature card for keyboard-visible focus", () => {
    expect(shouldExpandFeatureForFocus(true)).toBe(true);
  });

  it("does not expand a feature card for pointer focus", () => {
    expect(shouldExpandFeatureForFocus(false)).toBe(false);
  });
});
