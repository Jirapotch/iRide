import type { ActivityItem, VehicleKind } from "./activity-domain";

export interface CommunityPost { id: string; body: string; createdAt: string }
export interface MarketProduct { id: string; name: string; price: string; image: string; category: string; vehicleKinds: VehicleKind[] }
export interface SearchProfile { id: string; name: string; handle: string; role: string; initials: string }
export interface VehicleItem { id: string; name: string; nickname: string; kind: VehicleKind; image: string; detail: string }
export interface NotificationItem { id: string; title: string; detail: string; time: string }

export const activities: ActivityItem[] = [
  { id: "riverside-meet", kind: "meeting", title: "Riverside Vehicle Meetup", coordinate: [100.493, 13.768], locationLabel: "Rama VIII Bridge", startsAt: "2026-08-29T18:30", summary: "Cars, motorcycles and bicycles meet by the river before sunset.", host: "Bangkok Motion Club", participantCount: 24, capacity: 40, vehicleKinds: ["car", "motorcycle", "bicycle"], image: "/media/hero-road.webp" },
  { id: "urban-motion", kind: "event", title: "Urban Motion Weekend", coordinate: [100.546, 13.731], locationLabel: "Benjakitti Park", startsAt: "2026-08-30T09:00", endsAt: "2026-08-30T17:00", summary: "A city gathering for every kind of vehicle community.", host: "iRide Bangkok", participantCount: 86, capacity: 120, vehicleKinds: ["car", "motorcycle", "bicycle"], image: "/media/market-gear.webp" },
  { id: "khao-yai-drive", kind: "trip", title: "Bangkok to Khao Yai", coordinate: [100.72, 14.132], locationLabel: "Bangkok departure", destinationLabel: "Khao Yai", startsAt: "2026-08-31T05:45", summary: "An early mixed-vehicle trip with two scenic stops.", host: "Weekend Explorers", participantCount: 18, capacity: 25, vehicleKinds: ["car", "motorcycle"], route: [[100.5018, 13.7563], [100.91, 14.02], [101.372, 14.439]], image: "/media/trip-lake.webp" },
  { id: "maya-photo-session", kind: "photographerSpot", title: "Maya roadside photo session", coordinate: [100.624, 13.806], locationLabel: "Nong Bon curve", startsAt: "2026-08-29T07:00", endsAt: "2026-08-29T11:00", summary: "Maya Velocity is photographing cars, motorcycles and bicycles this morning.", host: "Maya Velocity", participantCount: 12, vehicleKinds: ["car", "motorcycle", "bicycle"], image: "/media/hero-road.webp" },
];

export const products: MarketProduct[] = [
  { id: "drive-camera", name: "4K Drive Camera", price: "฿6,900", image: "/media/gear-topbox.webp", category: "Car tech", vehicleKinds: ["car"] },
  { id: "helmet", name: "Adventure Helmet", price: "฿14,500", image: "/media/gear-helmet.webp", category: "Protection", vehicleKinds: ["motorcycle"] },
  { id: "cycle-pack", name: "All-weather Cycle Pack", price: "฿3,900", image: "/media/gear-jacket.webp", category: "Bicycle gear", vehicleKinds: ["bicycle"] },
  { id: "utility-boots", name: "Touring Boots", price: "฿7,500", image: "/media/gear-boots.webp", category: "Protection", vehicleKinds: ["motorcycle", "bicycle"] },
];

export const searchProfiles: SearchProfile[] = [
  { id: "maya-velocity", name: "Maya Velocity", handle: "@maya.velocity", role: "Photographer", initials: "MV" },
  { id: "narin-motion", name: "Narin Motion", handle: "@narin.motion", role: "Community host", initials: "NM" },
];

export const vehicles: VehicleItem[] = [
  { id: "car-1", name: "Grand Tourer S", nickname: "Midnight", kind: "car", image: "/media/vehicle-car.png", detail: "12,480 km · Ready" },
  { id: "moto-1", name: "Trail Master 900", nickname: "Atlas", kind: "motorcycle", image: "/media/garage-bike.webp", detail: "16,650 km · Good" },
  { id: "cycle-1", name: "Aero Road Pro", nickname: "Bluebird", kind: "bicycle", image: "/media/vehicle-bicycle.png", detail: "2,140 km · Tuned" },
];

export const notifications: NotificationItem[] = [
  { id: "comment-1", title: "Maya commented on your post", detail: "The light was perfect at that corner.", time: "2m" },
  { id: "event-1", title: "Urban Motion Weekend has new attendees", detail: "Six people you follow are going.", time: "1h" },
  { id: "trip-1", title: "Bangkok to Khao Yai starts soon", detail: "Departure briefing is available.", time: "3h" },
];
