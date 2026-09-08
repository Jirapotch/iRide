import { describe, expect, it } from "vitest";

import { captureData } from "./data-result";

class HttpFailure extends Error {
  constructor(
    readonly status: number,
    message = "sensitive backend detail",
  ) {
    super(message);
  }
}

describe("captureData", () => {
  it("preserves successful data", async () => {
    await expect(captureData(async () => ({ id: "event-1" }))).resolves.toEqual(
      {
        status: "success",
        data: { id: "event-1" },
      },
    );
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not-found"],
    [422, "validation"],
    [503, "unavailable"],
  ] as const)("classifies HTTP %i as %s", async (status, category) => {
    await expect(
      captureData(async () => {
        throw new HttpFailure(status);
      }),
    ).resolves.toEqual({ status: "error", error: { category } });
  });

  it("classifies fetch failures as unavailable", async () => {
    await expect(
      captureData(async () => {
        throw new TypeError("fetch failed with a private URL");
      }),
    ).resolves.toEqual({
      status: "error",
      error: { category: "unavailable" },
    });
  });

  it("does not expose unknown exception messages", async () => {
    const result = await captureData(async () => {
      throw new Error("database password leaked here");
    });

    expect(result).toEqual({
      status: "error",
      error: { category: "unknown" },
    });
    expect(JSON.stringify(result)).not.toContain("password");
  });
});
