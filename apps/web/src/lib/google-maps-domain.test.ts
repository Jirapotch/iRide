import { describe, expect, it } from "vitest";

import {
  googleMapsSearchUrl,
  parseGoogleMapsCoordinates,
} from "./google-maps-domain";

describe("Google Maps coordinates", () => {
  it.each([
    [
      "https://www.google.com/maps/@13.7563,100.5018,15z",
      { latitude: 13.7563, longitude: 100.5018 },
    ],
    [
      "https://www.google.com/maps/search/?api=1&query=13.7563%2C100.5018",
      { latitude: 13.7563, longitude: 100.5018 },
    ],
    [
      "https://maps.google.com/?q=13.7563,100.5018",
      { latitude: 13.7563, longitude: 100.5018 },
    ],
    [
      "https://www.google.com/maps/place/Test/data=!3d13.7563!4d100.5018",
      { latitude: 13.7563, longitude: 100.5018 },
    ],
  ])("parses supported coordinate URL %s", (input, expected) => {
    expect(parseGoogleMapsCoordinates(input)).toEqual(expected);
  });

  it.each([
    "https://example.com/maps/@13.7,100.5",
    "https://www.google.com/maps/@91,100,15z",
    "not a url",
  ])("rejects unsupported or invalid input %s", (input) => {
    expect(parseGoogleMapsCoordinates(input)).toBeNull();
  });

  it("builds the documented cross-platform coordinate search URL", () => {
    expect(
      googleMapsSearchUrl({ latitude: 13.7563, longitude: 100.5018 }),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=13.7563%2C100.5018",
    );
  });
});
