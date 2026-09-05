import { apiEnvSchema } from "./schemas";

export type ApiEnv = ReturnType<typeof getApiEnv>;

export function getApiEnv(
  input: Record<string, string | undefined> = process.env,
) {
  return apiEnvSchema.parse(input);
}
