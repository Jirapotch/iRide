import type { EnginePreset } from "./engine-catalog";

export interface CylinderLayout {
  phase: number;
  pair: number;
  z: number;
}

export interface JournalLayout {
  phase: number;
  pair: number;
  zMin: number;
  zMax: number;
}

export interface CrankLayout {
  cylinders: CylinderLayout[];
  journals: JournalLayout[];
  pairs: number;
  spacing: number;
  z0: number;
}

function phaseDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return distance > 180 ? 360 - distance : distance;
}

export function crankLayout(engine: EnginePreset): CrankLayout {
  const banked = engine.lay !== "I";
  const phase = engine.fire.map((firing, index) => {
    const bankAngle = !banked
      ? 0
      : engine.bank[index]! & 1
        ? -engine.va / 2
        : engine.va / 2;
    return (((90 - bankAngle + firing) % 360) + 360) % 360;
  });
  const pair = Array(engine.n).fill(0) as number[];
  if (banked) {
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < engine.n; i++) {
      (engine.bank[i]! & 1 ? right : left).push(i);
    }
    left.forEach((index, position) => {
      pair[index] = position;
    });
    const used = new Set<number>();
    right.forEach((index) => {
      let best = -1;
      let distance = Infinity;
      left.forEach((candidate) => {
        const next = phaseDistance(phase[index]!, phase[candidate]!);
        if (!used.has(candidate) && next < distance) {
          distance = next;
          best = candidate;
        }
      });
      if (best >= 0) {
        used.add(best);
        pair[index] = pair[best]!;
      } else {
        pair[index] = left.length + used.size;
      }
    });
  } else {
    for (let i = 0; i < engine.n; i++) pair[i] = i;
  }

  const pairs = Math.max(...pair) + 1;
  const spacing = 1.06;
  const z0 = (-(pairs - 1) * spacing) / 2;
  const cylinders = phase.map((angle, index) => ({
    phase: angle,
    pair: pair[index]!,
    z:
      z0 +
      pair[index]! * spacing +
      (banked ? (engine.bank[index]! & 1 ? 0.17 : -0.17) : 0),
  }));
  const journals: JournalLayout[] = [];
  for (const cylinder of cylinders) {
    const journal = journals.find(
      (item) =>
        item.pair === cylinder.pair &&
        phaseDistance(item.phase, cylinder.phase) < 0.01,
    );
    if (journal) {
      journal.zMin = Math.min(journal.zMin, cylinder.z);
      journal.zMax = Math.max(journal.zMax, cylinder.z);
    } else {
      journals.push({
        phase: cylinder.phase,
        pair: cylinder.pair,
        zMin: cylinder.z,
        zMax: cylinder.z,
      });
    }
  }
  return { cylinders, journals, pairs, spacing, z0 };
}

export function pistonTravel(
  ux: number,
  uy: number,
  px: number,
  py: number,
  rodLength: number,
): number {
  const projection = px * ux + py * uy;
  const cross = px * uy - py * ux;
  return (
    projection + Math.sqrt(Math.max(0, rodLength * rodLength - cross * cross))
  );
}
