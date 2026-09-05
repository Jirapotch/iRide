interface MapPoint {
  readonly latitude: number;
  readonly longitude: number;
}

interface ViewportSize {
  readonly height: number;
  readonly width: number;
}

export interface MapSelectionCameraOptions {
  readonly center: [number, number];
  readonly duration: number;
  readonly essential: false;
  readonly padding: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
}

export function mapSelectionCamera(
  point: MapPoint,
  viewport: ViewportSize,
  reducedMotion: boolean,
): MapSelectionCameraOptions {
  const desktop = viewport.width >= 1024;

  return {
    center: [point.longitude, point.latitude],
    duration: reducedMotion ? 0 : 420,
    essential: false,
    padding: desktop
      ? { top: 80, right: 420, bottom: 80, left: 80 }
      : {
          top: 72,
          right: 24,
          bottom: Math.round(viewport.height * 0.45),
          left: 24,
        },
  };
}
