import { describe, expect, it, vi } from "vitest";

import { synchronizeMapLocation } from "./map-location-sync";

describe("map location synchronization", () => {
  it("moves the marker and camera to the imported coordinates", () => {
    const setLngLat = vi.fn();
    const flyTo = vi.fn();

    synchronizeMapLocation(
      { flyTo },
      { setLngLat },
      { latitude: 18.788343, longitude: 98.9853 },
    );

    expect(setLngLat).toHaveBeenCalledOnce();
    expect(setLngLat).toHaveBeenCalledWith([98.9853, 18.788343]);
    expect(flyTo).toHaveBeenCalledOnce();
    expect(flyTo).toHaveBeenCalledWith({
      center: [98.9853, 18.788343],
      essential: false,
    });
  });
});
