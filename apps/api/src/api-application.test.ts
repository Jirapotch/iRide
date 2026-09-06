import { describe, expect, it } from "vitest";

import { resolveApiPort } from "./api-application";

describe("API server port", () => {
  it("uses Vercel's backend port when PORT is not injected", () => {
    expect(resolveApiPort({ VERCEL: "1" })).toBe(3000);
  });

  it("keeps the local API default and honors an explicit port", () => {
    expect(resolveApiPort({})).toBe(3001);
    expect(resolveApiPort({ PORT: "4310", VERCEL: "1" })).toBe(4310);
  });
});
