export const serviceNames = ["web", "api", "worker"] as const;

export type ServiceName = (typeof serviceNames)[number];

export interface HealthResponse {
  status: "ok";
  service: ServiceName;
  version: string;
}

export function createHealthResponse(
  service: ServiceName,
  version = "0.1.0",
): HealthResponse {
  return { status: "ok", service, version };
}
