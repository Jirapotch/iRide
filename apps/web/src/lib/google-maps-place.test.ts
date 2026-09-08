import { expect, it } from "vitest";
import { parseGoogleMapsCoordinates } from "./google-maps-domain";
import { resolveGoogleMapsCoordinates } from "./google-maps-resolver";

it("resolves a short share link with its place name", async () => {
  expect(
    await resolveGoogleMapsCoordinates(
      "https://maps.app.goo.gl/place",
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://www.google.com/maps/place/Rest+Stop/data=!3d15!4d100",
          },
        }),
    ),
  ).toEqual({ name: "Rest Stop", latitude: 15, longitude: 100 });
});

it("imports bare coordinates without inventing a place name", () => {
  expect(
    parseGoogleMapsCoordinates("https://maps.google.com/?q=15,100"),
  ).toEqual({ latitude: 15, longitude: 100 });
});

it("stops resolving an endless redirect chain", async () => {
  let requests = 0;
  expect(
    await resolveGoogleMapsCoordinates(
      "https://maps.app.goo.gl/place",
      async () => {
        requests++;
        return new Response(null, {
          status: 302,
          headers: { location: "https://maps.app.goo.gl/place" },
        });
      },
    ),
  ).toBeNull();
  expect(requests).toBe(5);
});

it("imports a decoded place name and prefers place coordinates to viewport center", () => {
  expect(
    parseGoogleMapsCoordinates(
      "https://www.google.com/maps/place/เชียงใหม่/@13,100,10z/data=!3d18.79!4d98.98?center=13,100",
    ),
  ).toEqual({ latitude: 18.79, longitude: 98.98, name: "เชียงใหม่" });
});
it("rejects directions instead of silently importing one point", () => {
  expect(
    parseGoogleMapsCoordinates(
      "https://www.google.com/maps/dir/A/B/@13,100,10z",
    ),
  ).toBeNull();
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
  expect(result).toBeNull();
});
