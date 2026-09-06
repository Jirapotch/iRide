import { describe, expect, it } from "vitest";

import { captureData } from "./data-result";

describe("captureData", () => {
  it("keeps a successful empty collection distinct from failure", async () => {
    await expect(captureData(async () => [])).resolves.toEqual({
      status: "success",
      data: [],
    });
  });

  it("returns an error state when the read throws", async () => {
    await expect(
      captureData(async () => {
        throw new Error("offline");
      }),
    ).resolves.toEqual({ status: "error" });
  });
});
