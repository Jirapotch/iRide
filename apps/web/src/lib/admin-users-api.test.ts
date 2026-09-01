import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deleteAdminModeratedContent } from "./admin-users-api";

afterEach(() => vi.unstubAllGlobals());

describe("deleteAdminModeratedContent", () => {
  it("uses the dedicated audited moderation endpoint rather than an owner delete endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteAdminModeratedContent(
      "signed.jwt",
      "22222222-2222-4222-8222-222222222222",
      "vehicle",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/api/v1/admin/moderation", "http://localhost:3001"),
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer signed.jwt" }),
        body: JSON.stringify({ id: "22222222-2222-4222-8222-222222222222", kind: "vehicle" }),
      }),
    );
  });
});
