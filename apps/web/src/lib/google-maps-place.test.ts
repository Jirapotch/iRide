import { expect, it } from "vitest";

import {
  googleMapsLocationUrl,
  parseGoogleMapsCoordinates,
} from "./google-maps-domain";
import { resolveGoogleMapsCoordinates } from "./google-maps-resolver";

it("resolves a mobile share link with its place name", async () => {
  const result = await resolveGoogleMapsCoordinates(
    "https://maps.app.goo.gl/place",
    async () =>
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://www.google.com/maps/place/Rest+Stop/data=!3d15!4d100",
        },
      }),
  );
  expect(result).toEqual({
    ok: true,
    location: { name: "Rest Stop", latitude: 15, longitude: 100 },
  });
});

it("extracts coordinates from a canonical Google Maps URL in HTML", async () => {
  const result = await resolveGoogleMapsCoordinates(
    "https://maps.app.goo.gl/place",
    async () =>
      new Response(
        '<html><head><link rel="canonical" href="https://www.google.com/maps/place/Cafe/data=!3d13.75!4d100.5"></head></html>',
        { status: 200, headers: { "content-type": "text/html" } },
      ),
  );
  expect(result).toEqual({
    ok: true,
    location: { name: "Cafe", latitude: 13.75, longitude: 100.5 },
  });
});

it("prefers canonical metadata over unrelated Google Maps URLs in HTML", async () => {
  const result = await resolveGoogleMapsCoordinates(
    "https://maps.app.goo.gl/place",
    async () =>
      new Response(
        '<script>"https://www.google.com/maps/@1,2,10z"</script><meta property="og:url" content="https://www.google.com/maps/place/Real/data=!3d13!4d100">',
        { status: 200, headers: { "content-type": "text/html" } },
      ),
  );
  expect(result).toEqual({
    ok: true,
    location: { name: "Real", latitude: 13, longitude: 100 },
  });
});

it("classifies a directions URL found only in HTML metadata", async () => {
  const result = await resolveGoogleMapsCoordinates(
    "https://maps.app.goo.gl/directions",
    async () =>
      new Response(
        '<meta property="og:url" content="https://www.google.com/maps/dir/Bangkok/Chiang+Mai">',
        { status: 200, headers: { "content-type": "text/html" } },
      ),
  );
  expect(result).toEqual({ ok: false, code: "directions-url" });
});

it("classifies invalid, unsupported, and directions URLs", async () => {
  await expect(resolveGoogleMapsCoordinates("not a url")).resolves.toEqual({
    ok: false,
    code: "invalid-url",
  });
  await expect(
    resolveGoogleMapsCoordinates("https://example.com/maps/@13,100"),
  ).resolves.toEqual({ ok: false, code: "unsupported-host" });
  await expect(
    resolveGoogleMapsCoordinates(
      "https://www.google.com/maps/dir/A/B/@13,100,10z",
    ),
  ).resolves.toEqual({ ok: false, code: "directions-url" });
});

it("classifies redirect loops and network failures", async () => {
  await expect(
    resolveGoogleMapsCoordinates(
      "https://maps.app.goo.gl/place",
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://maps.app.goo.gl/place" },
        }),
    ),
  ).resolves.toEqual({ ok: false, code: "redirect-failed" });
  await expect(
    resolveGoogleMapsCoordinates("https://maps.app.goo.gl/place", async () => {
      throw new TypeError("network unavailable");
    }),
  ).resolves.toEqual({ ok: false, code: "redirect-failed" });
});

it("allows five redirects before reading the final HTML response", async () => {
  let requests = 0;
  const result = await resolveGoogleMapsCoordinates(
    "https://maps.app.goo.gl/start",
    async () => {
      requests += 1;
      if (requests <= 5) {
        return new Response(null, {
          status: 302,
          headers: {
            location: `https://maps.app.goo.gl/hop-${requests}`,
          },
        });
      }
      return new Response(
        '<link rel="canonical" href="https://www.google.com/maps/@13,100,10z">',
        { status: 200, headers: { "content-type": "text/html" } },
      );
    },
  );
  expect(result).toEqual({
    ok: true,
    location: { latitude: 13, longitude: 100 },
  });
  expect(requests).toBe(6);
});

it("classifies timeouts without exposing the thrown error", async () => {
  await expect(
    resolveGoogleMapsCoordinates("https://maps.app.goo.gl/place", async () => {
      throw new DOMException("timed out", "TimeoutError");
    }),
  ).resolves.toEqual({ ok: false, code: "timeout" });
});

it("does not inspect Google HTML beyond 256 KB", async () => {
  const hiddenUrl =
    '<link rel="canonical" href="https://www.google.com/maps/@13,100,10z">';
  const result = await resolveGoogleMapsCoordinates(
    "https://maps.app.goo.gl/place",
    async () =>
      new Response(`${"x".repeat(256 * 1024)}${hiddenUrl}`, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
  );
  expect(result).toEqual({ ok: false, code: "no-coordinates" });
});

it("imports bare coordinates without inventing a place name", () => {
  expect(
    parseGoogleMapsCoordinates("https://maps.google.com/?q=15,100"),
  ).toEqual({ latitude: 15, longitude: 100 });
});

it("imports a decoded place name and prefers place coordinates to viewport center", () => {
  expect(
    parseGoogleMapsCoordinates(
      "https://www.google.com/maps/place/เชียงใหม่/@13,100,10z/data=!3d18.79!4d98.98?center=13,100",
    ),
  ).toEqual({ latitude: 18.79, longitude: 98.98, name: "เชียงใหม่" });
});

it("rejects a redirect outside Google even if it contains coordinates", async () => {
  const result = await resolveGoogleMapsCoordinates(
    "https://maps.app.goo.gl/test",
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/maps/@13,100,10z" },
      }),
  );
  expect(result).toEqual({ ok: false, code: "unsupported-host" });
});

it("builds Google Maps links from coordinates before falling back to a name", () => {
  expect(
    googleMapsLocationUrl({
      latitude: 13.75,
      longitude: 100.5,
      name: "Bangkok",
    }),
  ).toBe("https://www.google.com/maps/search/?api=1&query=13.75%2C100.5");
  expect(googleMapsLocationUrl({ name: "Bangkok Station" })).toBe(
    "https://www.google.com/maps/search/?api=1&query=Bangkok%20Station",
  );
});
