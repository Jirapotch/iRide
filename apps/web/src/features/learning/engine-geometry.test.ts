import { expect, it } from "vitest";

import { enginePresets } from "./engine-catalog";
import { crankLayout, pistonTravel } from "./engine-geometry";

it("places every cylinder and shares crank journals where appropriate", () => {
  for (const engine of enginePresets) {
    const layout = crankLayout(engine);
    expect(layout.cylinders).toHaveLength(engine.n);
    expect(layout.journals.length).toBeGreaterThan(0);
    expect(layout.pairs).toBeGreaterThan(0);
  }
  const boxer = enginePresets.find(({ id }) => id === "m2box")!;
  expect(crankLayout(boxer).cylinders[0]!.z).toBeCloseTo(
    crankLayout(boxer).cylinders[1]!.z,
    0,
  );
});

it("moves the piston by the rod and crank geometry without impossible travel", () => {
  const rod = 1.16;
  const radius = 0.38;
  expect(pistonTravel(0, 1, 0, radius, rod)).toBeCloseTo(rod + radius);
  expect(pistonTravel(0, 1, 0, -radius, rod)).toBeCloseTo(rod - radius);
});
