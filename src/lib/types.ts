export type Locale = "th" | "en";
export type FollowStatus = "none" | "pending" | "accepted";

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  locale: Locale;
  isPrivate: boolean;
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
  posts: Post[];
  isOwner: boolean;
  canViewContent: boolean;
  followStatus: FollowStatus;
};

export type Vehicle = {
  id: string;
  ownerId: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  color: string | null;
  description: string | null;
  coverUrl: string | null;
};

export type FollowRequest = {
  followerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
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
  vehicle: Pick<Vehicle, "id" | "name" | "brand" | "model" | "year"> | null;
  likesCount: number;
  commentsCount: number;
  likedByViewer: boolean;
  comments?: Comment[];
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  followStatus?: FollowStatus;
  locale?: Locale;
};
