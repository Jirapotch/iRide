import { z } from "zod";

const url = z.url();
const secret = z.string().min(1);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: url.default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: url.default("http://localhost:3001"),
  NEXT_PUBLIC_SUPABASE_URL: url.optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret.optional(),
  NEXT_PUBLIC_MAPTILER_KEY: secret.optional(),
});

export const serverEnvSchema = z.object({
  SUPABASE_URL: url,
  SUPABASE_PUBLISHABLE_KEY: secret,
  SUPABASE_SERVICE_ROLE_KEY: secret,
  CORS_ALLOWED_ORIGINS: secret,
  CLOUDFLARE_ACCOUNT_ID: secret,
  R2_ACCESS_KEY_ID: secret,
  R2_SECRET_ACCESS_KEY: secret,
  R2_BUCKET: secret,
  OPN_SECRET_KEY: secret,
  OPN_WEBHOOK_SECRET: secret,
});

export const apiEnvSchema = serverEnvSchema.extend({
  DATABASE_URL: url,
  WORKER_CRON_SECRET: secret,
});

export const migrationEnvSchema = z.object({
  MIGRATION_DATABASE_URL: url,
});

export const workerEnvSchema = serverEnvSchema.extend({
  DATABASE_URL: url,
  WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
});
