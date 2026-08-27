import "server-only";

import { serverEnvSchema } from "./schemas";

export type ServerEnv = ReturnType<typeof getServerEnv>;

export function getServerEnv(
  input: Record<string, string | undefined> = process.env,
) {
  return serverEnvSchema.parse(input);
}
