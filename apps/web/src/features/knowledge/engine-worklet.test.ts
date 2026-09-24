import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

import { buildAudioConfig } from "./engine-audio";
import { enginePresets } from "./engine-catalog";

interface ProcessorInstance {
  port: { onmessage: (event: { data: Record<string, unknown> }) => void };
  process: (input: Float32Array[][], output: Float32Array[][]) => boolean;
}

it("produces finite, non-silent engine audio from the local worklet", () => {
  const source = readFileSync(
    resolve(process.cwd(), "public/knowledge/engine-processor.js"),
    "utf8",
  );
  let Processor: (new () => ProcessorInstance) | null = null;
  class BaseProcessor {
    port = { onmessage: () => {} };
  }
  runInNewContext(source, {
    AudioWorkletProcessor: BaseProcessor,
    sampleRate: 48_000,
    Float32Array,
    Int32Array,
    Math,
    registerProcessor: (
      _name: string,
      constructor: new () => ProcessorInstance,
    ) => {
      Processor = constructor;
    },
  });
  expect(Processor).not.toBeNull();
  const processor = new (Processor as unknown as new () => ProcessorInstance)();
  const engine = enginePresets.find(({ id }) => id === "m2c")!;
  processor.port.onmessage({ data: buildAudioConfig(engine, 1, true, 0.6) });
  processor.port.onmessage({
    data: { rpm: 2500, thr: 0.4, load: 0.4, on: 1, master: 1 },
  });
  let energy = 0;
  for (let block = 0; block < 500; block++) {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    expect(processor.process([], [[left, right]])).toBe(true);
    for (const sample of left) {
      expect(Number.isFinite(sample)).toBe(true);
      energy += Math.abs(sample);
    }
  }
  expect(energy).toBeGreaterThan(1);
});
