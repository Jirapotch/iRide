import { describe, expect, it } from "vitest";

import {
  applyMarkerMention,
  findMarkerMentionQuery,
  toggleMarkerTag,
} from "./marker-mention-domain";

describe("marker mentions", () => {
  it("finds the active @ query immediately before the cursor", () => {
    expect(findMarkerMentionQuery("Meet us at @Lum", 15)).toEqual({
      start: 11,
      end: 15,
      query: "Lum",
    });
    expect(findMarkerMentionQuery("email@test.com", 14)).toBeNull();
  });

  it("replaces the active query with the selected marker title", () => {
    expect(
      applyMarkerMention(
        "Meet at @Lum tonight",
        { start: 8, end: 12, query: "Lum" },
        "Lumpini Park",
      ),
    ).toEqual({
      body: "Meet at @Lumpini Park tonight",
      cursor: 21,
    });
  });

  it("deduplicates tags, removes selected tags, and caps selection at five", () => {
    const first = { kind: "event" as const, id: "1" };
    expect(toggleMarkerTag([], first)).toEqual([first]);
    expect(toggleMarkerTag([first], first)).toEqual([]);
    const five = Array.from({ length: 5 }, (_, index) => ({
      kind: "event" as const,
      id: String(index),
    }));
    expect(
      toggleMarkerTag(five, { kind: "event", id: "extra" }),
    ).toEqual(five);
  });
});
