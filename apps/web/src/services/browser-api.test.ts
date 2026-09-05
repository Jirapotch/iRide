import { afterEach, describe, expect, it, vi } from "vitest";

import { browserApiMutation } from "./browser-api";

describe("browser API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the same-origin BFF and never accepts an access token", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({ data: { id: "comment-1" } }),
    );
    vi.stubGlobal("fetch", fetch);

    const result = await browserApiMutation<{ id: string }>(
      "/posts/post-1/comments",
      "POST",
      { body: "hello" },
    );

    expect(result).toEqual({ id: "comment-1" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/bff/posts/post-1/comments",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});
