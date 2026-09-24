import { expect, it } from "vitest";

import { enginePresets } from "./engine-catalog";
import { buildAudioConfig } from "./engine-audio";

it("sends each engine's firing order and cylinder bank to audio synthesis", () => {
  const twin = enginePresets.find(({ id }) => id === "m2c")!;
  const v8 = enginePresets.find(({ id }) => id === "v8x")!;
  expect(buildAudioConfig(twin, 1, true, 0.6)).toMatchObject({
    n: 2,
    fire: [0, 270],
    bank: [0, 0],
    vol: expect.any(Number),
  });
  expect(buildAudioConfig(v8, 1, true, 0.6).fire).toHaveLength(8);
});

it("changes pipe response with exhaust choice and mutes fully", () => {
  const engine = enginePresets.find(({ id }) => id === "v8t")!;
  const stock = buildAudioConfig(engine, 0, true, 0.6);
  const track = buildAudioConfig(engine, 5, true, 0.6);
  expect(stock.pipe).not.toBe(track.pipe);
  expect(track.turbo).toBe(1);
  expect(buildAudioConfig(engine, 5, true, 0).vol).toBe(0);
});
