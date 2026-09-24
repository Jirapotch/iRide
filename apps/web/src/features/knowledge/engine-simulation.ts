import type { EnginePreset } from "./engine-catalog";

export type EnginePhase = "off" | "key" | "crank" | "run";

export interface EngineState {
  phase: EnginePhase;
  rpm: number;
  throttle: number;
  throttleCommand: number;
  boost: number;
  crankAngle: number;
  crankTime: number;
  cutTime: number;
  forcedInduction: boolean;
  exhaust: number;
}

export interface EngineAudioFrame {
  rpm: number;
  thr: number;
  load: number;
  on: number;
  starter: number;
  cut: number;
  pop: number;
  boost: number;
  master: number;
  bov: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function createEngineState(): EngineState {
  return {
    phase: "off",
    rpm: 0,
    throttle: 0,
    throttleCommand: 0,
    boost: 0,
    crankAngle: 0,
    crankTime: 0,
    cutTime: 0,
    forcedInduction: true,
    exhaust: 0,
  };
}

export function startEngine(state: EngineState): void {
  if (state.phase !== "off") return;
  state.phase = "key";
  state.crankTime = 0;
}

export function stopEngine(state: EngineState): void {
  state.phase = "off";
  state.throttleCommand = 0;
  state.crankTime = 0;
}

function torque(engine: EnginePreset, rpm: number): number {
  const distance = (rpm - engine.peak) / (engine.red * 0.62);
  return Math.max(0, engine.tq * (1 - 0.7 * distance * distance));
}

export function stepEngine(
  state: EngineState,
  engine: EnginePreset,
  elapsed: number,
): EngineAudioFrame {
  const dt = clamp(elapsed, 0, 0.05);
  state.throttle +=
    (state.throttleCommand - state.throttle) *
    Math.min(1, dt * (state.throttleCommand > state.throttle ? 11 : 25));

  let bov = 0;
  if ((engine.turbo || engine.sc) && state.forcedInduction) {
    let target = 0;
    if (state.phase === "run") {
      target = engine.sc
        ? clamp(state.rpm / engine.peak, 0, 1) * state.throttle
        : state.throttle *
          clamp(
            (state.rpm - engine.idle * 1.5) / (engine.peak - engine.idle),
            0,
            1,
          );
    }
    const response = engine.sc ? 12 : target > state.boost ? 1.9 : 6.5;
    const before = state.boost;
    state.boost += (target - state.boost) * Math.min(1, dt * response);
    bov =
      engine.turbo &&
      before > 0.3 &&
      state.throttle < 0.08 &&
      before - state.boost > 0.003
        ? 1
        : 0;
  } else {
    state.boost = 0;
  }

  if (state.phase === "key") {
    state.crankTime += dt;
    if (state.crankTime >= 0.14) {
      state.phase = "crank";
      state.crankTime = 0;
    }
  } else if (state.phase === "crank") {
    state.crankTime += dt;
    const crankSpeed = 155 + Math.min(170, state.crankTime * 250);
    state.rpm += (crankSpeed - state.rpm) * Math.min(1, dt * 11);
    const duration = engine.n <= 2 ? 0.9 : engine.n >= 8 ? 0.56 : 0.72;
    if (state.crankTime > duration) {
      state.phase = "run";
      state.rpm = Math.max(state.rpm, engine.idle * 0.72);
    }
  } else if (state.phase === "run") {
    const boost = 1 + state.boost * (engine.bg ?? 0);
    const idleTorque =
      clamp((engine.idle - state.rpm) / 220, 0, 1) * engine.tq * 0.45;
    const target =
      engine.idle +
      (engine.red - engine.idle) * state.throttle ** 1.25 +
      engine.red * 0.07 * state.throttle ** 5;
    const demand = clamp((target - state.rpm) / (engine.red * 0.045), 0, 1);
    const combustion =
      (state.cutTime > 0
        ? 0
        : torque(engine, state.rpm) * state.throttle * demand * boost) +
      idleTorque;
    const drag =
      engine.tq *
      (0.03 + 0.23 * (state.rpm / engine.red) ** 1.45) *
      (1 - 0.35 * state.throttle);
    state.rpm += ((combustion - drag) / engine.base.inertia) * dt * 12.5;
    if (state.rpm < engine.idle * 0.65) {
      state.rpm += (engine.idle * 0.65 - state.rpm) * Math.min(1, dt * 5);
    }
    if (state.cutTime > 0) state.cutTime = Math.max(0, state.cutTime - dt);
    if (state.rpm >= engine.red && state.cutTime <= 0) state.cutTime = 0.075;
    state.rpm = clamp(state.rpm, 300, engine.red * 1.005);
  } else {
    state.rpm += (0 - state.rpm) * Math.min(1, dt * 2.6);
    if (state.rpm < 0.01) state.rpm = 0;
  }

  state.crankAngle = (state.crankAngle + state.rpm * 6 * dt) % 720;
  let load = 0;
  let cut = 0;
  let pop = 0;
  if (state.phase === "run") {
    const overrun = state.throttle < 0.05 && state.rpm > engine.idle * 2.4;
    load = overrun
      ? 0.02
      : Math.max(state.throttle, state.rpm < engine.idle * 1.3 ? 0.13 : 0.05);
    if (overrun && state.exhaust > 0) {
      cut = 0.18 + (0.25 * state.rpm) / engine.red;
      pop = 0.35 + (0.5 * state.exhaust) / 2;
    }
    if (state.cutTime > 0) {
      cut = 0.85;
      pop = 0.9;
      load = 0.05;
    }
  }
  return {
    rpm: state.rpm,
    thr: state.throttle,
    load,
    on: state.phase === "run" ? 1 : 0,
    starter: state.phase === "crank" ? 1 : 0,
    cut,
    pop,
    boost: state.boost,
    master: state.phase === "off" && state.rpm < 60 ? 0 : 1,
    bov,
  };
}
