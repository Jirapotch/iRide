import { workerEnvSchema } from "./schemas";

export type WorkerEnv = ReturnType<typeof getWorkerEnv>;

export function getWorkerEnv(
  input: Record<string, string | undefined> = process.env,
) {
  return workerEnvSchema.parse(input);
}
