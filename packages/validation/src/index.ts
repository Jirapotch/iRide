import { z } from "zod";

import {
  eventKinds,
  profileVisibilities,
  serviceNames,
  vehicleKinds,
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

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const nullableText = (maximum: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed || null;
    })
    .refine((value) => value === null || value.length <= maximum, "too_long");
const coordinate = z.number().finite();
const latitude = coordinate.min(-90).max(90);
const longitude = coordinate.min(-180).max(180);
const dateTime = z.iso.datetime({ offset: true });
const timezone = requiredText(64);

export const createPostSchema = z
  .object({ body: requiredText(2_000) })
  .strict();

export const updatePostSchema = createPostSchema;

const eventFields = {
  kind: z.enum(eventKinds),
  title: requiredText(120),
  description: nullableText(2_000),
  locationLabel: requiredText(160),
  latitude,
  longitude,
  destinationLabel: nullableText(160).optional(),
  destinationLatitude: latitude.nullable().optional(),
  destinationLongitude: longitude.nullable().optional(),
  startsAt: dateTime,
  endsAt: dateTime.nullable().optional(),
  timezone,
  vehicleKinds: z.array(z.enum(vehicleKinds)).min(1).max(vehicleKinds.length),
} as const;

export const createEventSchema = z
  .object(eventFields)
  .strict()
  .superRefine(validateEvent);

export const updateEventSchema = z
  .object(
    Object.fromEntries(
      Object.entries(eventFields).map(([key, value]) => [key, value.optional()]),
    ) as { [Key in keyof typeof eventFields]: z.ZodOptional<(typeof eventFields)[Key]> },
  )
  .strict()
  .refine((value) => Object.keys(value).length > 0, "empty_update")
  .superRefine(validatePartialEvent);

const photographerSpotFields = {
  title: requiredText(120),
  description: nullableText(2_000),
  locationLabel: requiredText(160),
  latitude,
  longitude,
  startsAt: dateTime,
  endsAt: dateTime,
  timezone,
} as const;

export const createPhotographerSpotSchema = z
  .object(photographerSpotFields)
  .strict()
  .superRefine(validateTimeRange);

export const updatePhotographerSpotSchema = z
  .object(
    Object.fromEntries(
      Object.entries(photographerSpotFields).map(([key, value]) => [
        key,
        value.optional(),
      ]),
    ) as {
      [Key in keyof typeof photographerSpotFields]: z.ZodOptional<
        (typeof photographerSpotFields)[Key]
      >;
    },
  )
  .strict()
  .refine((value) => Object.keys(value).length > 0, "empty_update")
  .superRefine(validatePartialCoordinates)
  .superRefine(validateTimeRange);

function validateEvent(
  value: z.infer<typeof createEventSchema>,
  context: z.RefinementCtx,
) {
  validatePartialCoordinates(value, context);
  validateTimeRange(value, context);
  if (
    value.kind === "trip" &&
    (!value.destinationLabel ||
      value.destinationLatitude == null ||
      value.destinationLongitude == null)
  ) {
    context.addIssue({
      code: "custom",
      message: "trip_destination_required",
      path: ["destinationLabel"],
    });
  }
}

function validatePartialEvent(
  value: Record<string, unknown>,
  context: z.RefinementCtx,
) {
  validatePartialCoordinates(value, context);
  validateTimeRange(value, context);
  const destinationKeys = [
    "destinationLabel",
    "destinationLatitude",
    "destinationLongitude",
  ];
  const provided = destinationKeys.filter((key) => value[key] !== undefined);
  if (provided.length > 0 && provided.length < destinationKeys.length) {
    context.addIssue({
      code: "custom",
      message: "destination_fields_together",
      path: ["destinationLabel"],
    });
  }
}

function validatePartialCoordinates(
  value: Record<string, unknown>,
  context: z.RefinementCtx,
) {
  const hasLatitude = value.latitude !== undefined;
  const hasLongitude = value.longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: "custom",
      message: "coordinates_pair",
      path: [hasLatitude ? "longitude" : "latitude"],
    });
  }
}

function validateTimeRange(
  value: { startsAt?: unknown; endsAt?: unknown },
  context: z.RefinementCtx,
) {
  if (
    typeof value.startsAt === "string" &&
    typeof value.endsAt === "string" &&
    Date.parse(value.endsAt) <= Date.parse(value.startsAt)
  ) {
    context.addIssue({
      code: "custom",
      message: "ends_after_starts",
      path: ["endsAt"],
    });
  }
}
