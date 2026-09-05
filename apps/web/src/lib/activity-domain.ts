export type ActivityKind = "meeting" | "event" | "trip";
export type ActivityFilter = "all" | ActivityKind;
export type VehicleKind = "car" | "motorcycle" | "bicycle";
export type Coordinate = [longitude: number, latitude: number];

export interface ActivityItem {
  id: string; kind: ActivityKind; title: string; coordinate: Coordinate;
  locationLabel: string; startsAt: string; endsAt?: string; summary: string;
  host: string; participantCount: number; capacity?: number;
  vehicleKinds: VehicleKind[]; destinationLabel?: string; route?: Coordinate[];
  image?: string; createdByViewer?: boolean;
}

export interface CreateActivityInput {
  kind: ActivityKind; title: string;
  locationLabel: string; startsAt: string; summary: string;
  vehicleKinds: VehicleKind[]; destinationLabel?: string; capacity?: number;
}

export interface SearchableProfile { id: string; name: string; handle: string; role: string }
export interface SearchResult { id: string; title: string; subtitle: string; kind: "profile" | "activity" }

export const BANGKOK_CENTER: Coordinate = [100.5018, 13.7563];

export function filterActivities(items: readonly ActivityItem[], filter: ActivityFilter): ActivityItem[] {
  return filter === "all" ? [...items] : items.filter((item) => item.kind === filter);
}

export function validateCreateActivity(input: CreateActivityInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = "Title is required";
  if (!input.locationLabel.trim()) errors.locationLabel = "Location is required";
  if (!input.startsAt) errors.startsAt = "Date and time are required";
  if (input.kind === "trip" && !input.destinationLabel?.trim()) errors.destinationLabel = "Destination is required";
  if (input.vehicleKinds.length === 0) errors.vehicleKinds = "Choose at least one vehicle type";
  return errors;
}

export function createActivity(input: CreateActivityInput, id = `activity-${Date.now()}`): ActivityItem {
  const activity: ActivityItem = {
    id, kind: input.kind, title: input.title.trim(), coordinate: BANGKOK_CENTER,
    locationLabel: input.locationLabel.trim(), startsAt: input.startsAt,
    summary: input.summary.trim(), host: "You", participantCount: 1,
    vehicleKinds: input.vehicleKinds,
    createdByViewer: true,
  };
  if (input.capacity !== undefined) activity.capacity = input.capacity;
  if (input.destinationLabel?.trim()) activity.destinationLabel = input.destinationLabel.trim();
  if (input.kind === "trip") activity.route = [BANGKOK_CENTER, [101.372, 14.439]];
  return activity;
}

export function searchApp(query: string, activities: readonly ActivityItem[], profiles: readonly SearchableProfile[]): { profiles: SearchResult[]; activities: SearchResult[] } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { profiles: [], activities: [] };
  return {
    profiles: profiles.filter((item) => includes(needle, item.name, item.handle, item.role)).map((item) => ({ id: item.id, title: item.name, subtitle: `${item.handle} · ${item.role}`, kind: "profile" as const })),
    activities: activities.filter((item) => includes(needle, item.title, item.locationLabel, item.host)).map((item) => ({ id: item.id, title: item.title, subtitle: `${item.kind} · ${item.locationLabel}`, kind: "activity" as const })),
  };
}

function includes(query: string, ...values: string[]): boolean { return values.some((value) => value.toLowerCase().includes(query)); }
