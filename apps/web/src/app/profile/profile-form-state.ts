export type ProfileFieldErrorCode =
  | "USERNAME_REQUIRED"
  | "USERNAME_FORMAT"
  | "USERNAME_RESERVED"
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_INVALID";

export interface ProfileFormState {
  readonly errorCode: string | null;
  readonly fieldErrors: Readonly<{
    username?: ProfileFieldErrorCode;
    displayName?: ProfileFieldErrorCode;
  }>;
  readonly values: {
    readonly username: string;
    readonly displayName: string;
    readonly bio: string;
    readonly locationName: string;
    readonly visibility: "public" | "followers" | "private";
  } | null;
}
