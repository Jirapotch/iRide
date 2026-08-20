import type { Post, Profile, Vehicle } from "@/lib/types";

export const demoProfile: Profile = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "narin.drives",
  displayName: "Narin Chaiyasit",
  bio: "Weekend drives, mountain roads, and an unreasonable love for clean wheels.",
  location: "Chiang Mai, Thailand",
  avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80",
  coverUrl: null,
  locale: "th",
  isPrivate: false,
  followersCount: 1284,
  followingCount: 342,
};

export const demoVehicles: Vehicle[] = [
  {
    id: "00000000-0000-0000-0000-000000000101", ownerId: demoProfile.id, name: "Mochi", brand: "Mazda", model: "MX-5 RF", year: 2022, trim: "2.0 RF", color: "Snowflake White Pearl", description: "Small, light, and always ready for a sunrise run.", coverUrl: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "00000000-0000-0000-0000-000000000102", ownerId: demoProfile.id, name: "Blue", brand: "Honda", model: "Civic Hatchback", year: 2020, trim: "Turbo RS", color: "Brilliant Sporty Blue", description: "The practical daily that still makes every commute fun.", coverUrl: "https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=85",
  },
];

export const demoPosts: Post[] = [
  {
    id: "00000000-0000-0000-0000-000000001001", body: "เช้านี้ขับขึ้นดอยก่อนเมืองจะตื่น อากาศเย็น ถนนโล่ง และแสงแรกพอดีกับจุดชมวิว บางครั้งความสุขก็เรียบง่ายแค่นี้ 🚗✨", photoUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1400&q=85", createdAt: "2026-08-20T00:45:00.000Z", author: demoProfile, vehicle: demoVehicles[0], likesCount: 248, commentsCount: 19, likedByViewer: false,
  },
  {
    id: "00000000-0000-0000-0000-000000001002", body: "Sunday wash complete. Nothing dramatic—just good music, cold coffee, and two hours making the daily look new again.", photoUrl: "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=1400&q=85", createdAt: "2026-08-19T08:10:00.000Z", author: { username: "mint.motors", displayName: "Mint K.", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80" }, vehicle: { id: "00000000-0000-0000-0000-000000000103", name: "Milo", brand: "Mini", model: "Cooper S", year: 2021 }, likesCount: 117, commentsCount: 8, likedByViewer: true,
  },
];
