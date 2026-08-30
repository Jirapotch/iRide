import { describe, expect, it, vi } from "vitest";

import { resolveGoogleMapsCoordinates } from "./google-maps-resolver";

describe("Google Maps short-link resolver", () => {
  it("follows allowlisted redirects and parses the final coordinates", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://www.google.com/maps/@13.7,100.5,15z" },
        }),
      );
    await expect(
      resolveGoogleMapsCoordinates("https://maps.app.goo.gl/abc", fetcher),
    ).resolves.toEqual({ latitude: 13.7, longitude: 100.5 });
  });

  it("rejects redirects that leave the Google Maps host allowlist", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/@13.7,100.5" },
        }),
      );
    await expect(
      resolveGoogleMapsCoordinates("https://maps.app.goo.gl/abc", fetcher),
    ).resolves.toBeNull();
  });
});
