import { z } from "zod";

import {
  profileVisibilities,
  serviceNames,
  type HealthResponse,
} from "@iride/types";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.enum(serviceNames),
  version: z.string().min(1),
}) satisfies z.ZodType<HealthResponse>;

export const reservedUsernames = [
  "account",
  "api",
  "auth",
  "login",
  "logout",
  "onboarding",
  "profile",
  "profiles",
  "users",
  "feed",
  "explore",
  "garage",
  "events",
  "communities",
  "photographers",
  "marketplace",
  "cart",
  "orders",
  "settings",
  "admin",
  "support",
  "help",
  "about",
  "terms",
  "privacy",
  "iride",
  "th",
  "en",
] as const;

const usernamePattern = /^[a-z0-9][a-z0-9_]{2,29}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .regex(usernamePattern, "username_format")
      .refine(
        (value) => !reservedUsernames.includes(value as never),
        "username_reserved",
      ),
  );

const optionalTrimmedText = (maximum: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine((value) => value === null || value.length <= maximum, "too_long");

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: optionalTrimmedText(500).optional(),
    locationName: optionalTrimmedText(120).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    visibility: z.enum(profileVisibilities).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "empty_update")
  .superRefine((value, context) => {
    const hasLatitude = value.latitude !== undefined;
    const hasLongitude = value.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        message: "coordinates_pair",
        path: hasLatitude ? ["longitude"] : ["latitude"],
      });
    }
    if (
      hasLatitude &&
      hasLongitude &&
      (value.latitude === null) !== (value.longitude === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "coordinates_pair",
        path: ["longitude"],
      });
    }
  });
