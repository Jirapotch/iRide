import { z } from "zod";

export const usernameSchema = z.string().trim().min(3).max(30).regex(/^[a-z0-9._]+$/);
export const profileSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(180).optional().or(z.literal("")),
  location: z.string().trim().max(80).optional().or(z.literal("")),
});
export const vehicleSchema = z.object({
  name: z.string().trim().min(1).max(40),
  brand: z.string().trim().max(50).optional().or(z.literal("")),
  model: z.string().trim().max(50).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1886).max(new Date().getFullYear() + 1).optional().or(z.literal("")),
  trim: z.string().trim().max(80).optional().or(z.literal("")),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});
export const postSchema = z.object({
  body: z.string().trim().min(1).max(1200),
  vehicleId: z.preprocess((value) => value === "none" ? "" : value, z.string().uuid().optional().or(z.literal(""))),
});
export const commentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});
