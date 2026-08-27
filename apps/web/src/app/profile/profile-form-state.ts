export interface ProfileFormState {
  readonly errorCode: string | null;
  readonly values: {
    readonly username: string;
    readonly displayName: string;
    readonly bio: string;
    readonly locationName: string;
    readonly visibility: "public" | "followers" | "private";
  } | null;
}
