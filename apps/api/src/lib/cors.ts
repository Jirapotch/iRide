const DEFAULT_ALLOWED_ORIGIN = "http://localhost:3000";

export interface CorsDecision {
  readonly allowed: boolean;
  readonly headers: Headers;
}

export function createCorsDecision(
  request: Pick<Request, "headers">,
  configuredOrigins = process.env.CORS_ALLOWED_ORIGINS,
  methods = "GET, OPTIONS",
): CorsDecision {
  const origin = request.headers.get("origin");
  const headers = new Headers({ Vary: "Origin" });

  if (!origin) {
    return { allowed: true, headers };
  }

  const allowedOrigins = new Set(
    (configuredOrigins ?? DEFAULT_ALLOWED_ORIGIN)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const allowed = allowedOrigins.has(origin);

  if (allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", methods);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Max-Age", "600");
  }

  return { allowed, headers };
}
