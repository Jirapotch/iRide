import { describe, expect, it } from "vitest";

import { enginePresets, getFiringIntervals } from "./engine-catalog";

describe("engine catalog", () => {
  it("retains all 35 distinct engines from the supplied simulator", () => {
    expect(enginePresets).toHaveLength(35);
    expect(new Set(enginePresets.map(({ id }) => id)).size).toBe(35);
    expect(enginePresets.find(({ id }) => id === "m2c")?.fire).toEqual([
      0, 270,
    ]);
    expect(enginePresets.find(({ id }) => id === "v8x")?.n).toBe(8);
  });

  it("keeps a valid 720 degree firing cycle for every engine", () => {
    for (const engine of enginePresets) {
      expect(engine.fire).toHaveLength(engine.n);
      expect(engine.bank).toHaveLength(engine.n);
      expect(engine.fire.every((angle) => angle >= 0 && angle < 720)).toBe(
        true,
      );
      expect(
        getFiringIntervals(engine).reduce((sum, value) => sum + value, 0),
      ).toBe(720);
      expect(engine.idle).toBeLessThan(engine.red);
    }
  });
});
