interface MapCamera {
  flyTo(options: {
    readonly center: [number, number];
    readonly essential: boolean;
  }): unknown;
}

interface MapMarker {
  setLngLat(coordinates: [number, number]): unknown;
}

export function synchronizeMapLocation(
  map: MapCamera,
  marker: MapMarker,
  coordinates: { readonly latitude: number; readonly longitude: number },
) {
  const center: [number, number] = [
    coordinates.longitude,
    coordinates.latitude,
  ];
  marker.setLngLat(center);
  map.flyTo({ center, essential: false });
}
