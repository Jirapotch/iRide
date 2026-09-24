import { expect, it } from "vitest";

import { enginePresets } from "./engine-catalog";
import {
  createEngineState,
  startEngine,
  stepEngine,
  stopEngine,
} from "./engine-simulation";

const engine = enginePresets.find(({ id }) => id === "m2c")!;

function advance(
  state: ReturnType<typeof createEngineState>,
  seconds: number,
  preset = engine,
) {
  let frame;
  for (let i = 0; i < seconds * 60; i++)
    frame = stepEngine(state, preset, 1 / 60);
  return frame!;
}

it("cranks to idle only after starting, then shuts down", () => {
  const state = createEngineState();
  expect(advance(state, 1).master).toBe(0);
  startEngine(state);
  const running = advance(state, 3);
  expect(state.phase).toBe("run");
  expect(state.rpm).toBeGreaterThan(engine.idle * 0.65);
  expect(running.on).toBe(1);
  stopEngine(state);
  expect(advance(state, 4).master).toBe(0);
});

it("responds to throttle and respects the engine redline", () => {
  const state = createEngineState();
  startEngine(state);
  advance(state, 3);
  const idle = state.rpm;
  state.throttleCommand = 1;
  advance(state, 5);
  expect(state.rpm).toBeGreaterThan(idle + 1000);
  expect(state.rpm).toBeLessThanOrEqual(engine.red * 1.005);
  state.throttleCommand = 0;
  advance(state, 3);
  expect(state.rpm).toBeLessThan(engine.red * 0.8);
});

it("starts, revs, and cuts within the redline for all 35 profiles", () => {
  for (const preset of enginePresets) {
    const state = createEngineState();
    startEngine(state);
    advance(state, 3, preset);
    expect(state.phase, preset.id).toBe("run");
    expect(state.rpm, preset.id).toBeGreaterThan(preset.idle * 0.65);
    const idleRpm = state.rpm;
    state.throttleCommand = 1;
    advance(state, 5, preset);
    expect(state.rpm, preset.id).toBeGreaterThan(idleRpm + 300);
    expect(state.rpm, preset.id).toBeLessThanOrEqual(preset.red * 1.005);
    state.throttleCommand = 0;
    advance(state, 4, preset);
    expect(state.rpm, preset.id).toBeLessThan(preset.red * 0.9);
  }
});
