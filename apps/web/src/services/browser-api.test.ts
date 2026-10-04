import { afterEach, describe, expect, it, vi } from "vitest";

import { browserApiMutation, browserApiUpload } from "./browser-api";

describe("browser API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads multipart documents through BFF without overriding the boundary", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { id: "doc-1" } }));
    vi.stubGlobal("fetch", fetch);
    const data = new FormData();
    data.set(
      "file",
      new Blob(["receipt"], { type: "application/pdf" }),
      "receipt.pdf",
    );
    expect(
      await browserApiUpload("/vehicles/vehicle-1/documents", data),
    ).toEqual({ id: "doc-1" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/bff/vehicles/vehicle-1/documents",
      { method: "POST", body: data, cache: "no-store" },
    );
  });

  it("uses the same-origin BFF and never accepts an access token", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { id: "comment-1" } }));
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
