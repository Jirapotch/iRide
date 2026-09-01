import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteContent, deleteVehicle } from "./content-api";

afterEach(() => vi.unstubAllGlobals());

describe("generic delete API clients", () => {
  it("keeps community, map, and profile deletes on the generic authenticated endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const token = "signed.jwt";

    await deleteContent(token, "posts", "11111111-1111-4111-8111-111111111111");
    await deleteContent(token, "events", "22222222-2222-4222-8222-222222222222");
    await deleteContent(token, "photographer-spots", "33333333-3333-4333-8333-333333333333");
    await deleteVehicle(token, "44444444-4444-4444-8444-444444444444");

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://localhost:3001/api/v1/posts/11111111-1111-4111-8111-111111111111",
      "http://localhost:3001/api/v1/events/22222222-2222-4222-8222-222222222222",
      "http://localhost:3001/api/v1/photographer-spots/33333333-3333-4333-8333-333333333333",
      "http://localhost:3001/api/v1/vehicles/44444444-4444-4444-8444-444444444444",
    ]);
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit).headers instanceof Headers ? false : true)).toBe(true);
  });
});
