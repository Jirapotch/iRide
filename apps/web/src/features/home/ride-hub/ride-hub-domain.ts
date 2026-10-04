export const RIDE_FEATURES = [
  "community",
  "activities",
  "trips",
  "routes",
  "knowledge",
  "games",
] as const;
export type RideFeature = (typeof RIDE_FEATURES)[number];
export type RideMode = "explore" | "routes" | "places" | "ride";
export type RideView = "overview" | "ride" | "map" | "focus" | "tour";

const destinations: Record<RideFeature, string> = {
  community: "/community",
  activities: "/activities",
  trips: "/activities?kinds=trip",
  routes: "/maps",
  knowledge: "/knowledge",
  games: "/games",
};
export function featureHref(feature: RideFeature) {
  return destinations[feature];
}
export function visibleFeature(value: unknown): RideFeature | null {
  return RIDE_FEATURES.find((feature) => feature === value) ?? null;
}
export function gestureIntent(dx: number, dy: number, embed: boolean) {
  if (Math.hypot(dx, dy) < 8) return "tap";
  if (embed && Math.abs(dy) >= Math.abs(dx)) return "scroll";
  return "rotate";
}
export function renderPolicy({
  visible,
  inView,
  reducedMotion,
}: {
  visible: boolean;
  inView: boolean;
  reducedMotion: boolean;
}) {
  if (!visible || !inView) return "pause";
  return reducedMotion ? "demand" : "animate";
}
