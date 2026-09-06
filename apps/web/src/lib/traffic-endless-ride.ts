export const rideIds = ["sedan", "sport", "moto", "cycle"] as const;
export type RideId = (typeof rideIds)[number];

export interface RunResult {
  readonly distance: number;
  readonly misses: number;
  readonly score: number;
  readonly splits: number;
  readonly stageIndex: number;
  readonly survivedSeconds: number;
}

export interface GameSession {
  readonly bestScore: number;
  readonly mode: "select" | "playing" | "over";
  readonly result: RunResult | null;
  readonly rideId: RideId;
}

interface StageDefinition {
  readonly distance: number;
  readonly spawnInterval: number;
  readonly speedMultiplier: number;
  readonly botMultiplier: number;
  readonly jamGap: number;
  readonly laneChanges: boolean;
}

export interface StageSnapshot {
  readonly botMultiplier: number;
  readonly index: number;
  readonly jamGap: number;
  readonly laneChanges: boolean;
  readonly progress: number;
  readonly spawnInterval: number;
  readonly speedMultiplier: number;
}

const stages: readonly StageDefinition[] = [
  {
    distance: 0,
    spawnInterval: 2.2,
    speedMultiplier: 0.48,
    laneChanges: false,
    botMultiplier: 0.76,
    jamGap: 99,
  },
  {
    distance: 900,
    spawnInterval: 1.78,
    speedMultiplier: 0.58,
    laneChanges: false,
    botMultiplier: 0.83,
    jamGap: 34,
  },
  {
    distance: 2_400,
    spawnInterval: 1.4,
    speedMultiplier: 0.68,
    laneChanges: true,
    botMultiplier: 0.89,
    jamGap: 30,
  },
  {
    distance: 4_600,
    spawnInterval: 1.08,
    speedMultiplier: 0.78,
    laneChanges: true,
    botMultiplier: 0.95,
    jamGap: 26,
  },
  {
    distance: 7_600,
    spawnInterval: 0.84,
    speedMultiplier: 0.88,
    laneChanges: true,
    botMultiplier: 1.02,
    jamGap: 22,
  },
  {
    distance: 11_500,
    spawnInterval: 0.64,
    speedMultiplier: 1,
    laneChanges: true,
    botMultiplier: 1.1,
    jamGap: 18,
  },
] as const;

export function stageAt(distance: number): StageSnapshot {
  let index = 0;
  while (index < stages.length - 1 && distance >= stages[index + 1]!.distance) {
    index += 1;
  }
  const current = stages[index]!;
  const next = stages[Math.min(index + 1, stages.length - 1)]!;
  const rawProgress =
    next.distance > current.distance
      ? Math.min(
          1,
          (distance - current.distance) / (next.distance - current.distance),
        )
      : 1;
  const eased = rawProgress * rawProgress * (3 - 2 * rawProgress);
  const interpolate = (from: number, to: number) => from + (to - from) * eased;

  return {
    index,
    progress: rawProgress,
    laneChanges: current.laneChanges,
    spawnInterval: interpolate(current.spawnInterval, next.spawnInterval),
    speedMultiplier: interpolate(current.speedMultiplier, next.speedMultiplier),
    botMultiplier: interpolate(current.botMultiplier, next.botMultiplier),
    jamGap: interpolate(current.jamGap, next.jamGap),
  };
}

export function initialSession(): GameSession {
  return { bestScore: 0, mode: "select", result: null, rideId: "sedan" };
}

export function startRun(session: GameSession, rideId: RideId): GameSession {
  return { ...session, mode: "playing", result: null, rideId };
}

export function finishRun(
  session: GameSession,
  result: RunResult,
): GameSession {
  return {
    ...session,
    bestScore: Math.max(session.bestScore, Math.floor(result.score)),
    mode: "over",
    result,
  };
}
