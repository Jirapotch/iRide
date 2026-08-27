import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "./index";

describe("healthResponseSchema", () => {
  it("rejects an unknown service", () => {
    expect(() =>
      healthResponseSchema.parse({
        status: "ok",
        service: "unknown",
        version: "0.1.0",
      }),
    ).toThrow();
  });
});
