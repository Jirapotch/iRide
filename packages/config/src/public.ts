import { publicEnvSchema } from "./schemas";

export type PublicEnv = ReturnType<typeof getPublicEnv>;

export function getPublicEnv(
  input: Record<string, string | undefined> = process.env,
) {
  return publicEnvSchema.parse(input);
}
