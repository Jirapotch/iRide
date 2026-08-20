export type Locale = "th" | "en";

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  locale: Locale;
  followersCount: number;
  followingCount: number;
};

export type ViewerContext = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  followersCount: number;
  vehicleCount: number;
};

export type MemberProfile = {
  profile: Profile;
  vehicles: Vehicle[];
  isOwner: boolean;
  isFollowing: boolean;
};

export type Vehicle = {
  id: string;
  ownerId: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  color: string | null;
  description: string | null;
  coverUrl: string | null;
};

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: Pick<Profile, "username" | "displayName" | "avatarUrl">;
};

export type Post = {
  id: string;
  body: string;
  photoUrl: string | null;
  createdAt: string;
  author: Pick<Profile, "username" | "displayName" | "avatarUrl">;
  vehicle: Pick<Vehicle, "id" | "nickname" | "make" | "model" | "year"> | null;
  likesCount: number;
  commentsCount: number;
  likedByViewer: boolean;
  comments?: Comment[];
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};
