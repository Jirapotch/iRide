import {
  authenticateRequest,
  AuthenticationError,
  toAuthErrorBody,
  type AuthContext,
} from "@iride/auth";

import { createCorsDecision } from "./cors";

export interface AuthMeDependencies {
  readonly authenticate: (
    request: Pick<Request, "headers">,
  ) => Promise<AuthContext>;
  readonly allowedOrigins?: string;
}

export async function handleAuthMe(
  request: Request,
  dependencies: AuthMeDependencies = productionDependencies(),
): Promise<Response> {
  const cors = createCorsDecision(request, dependencies.allowedOrigins);
  if (!cors.allowed) {
    return Response.json(
      { error: { code: "CORS_ORIGIN_DENIED", message: "Origin is not allowed." } },
      { status: 403, headers: cors.headers },
    );
  }

  try {
    const context = await dependencies.authenticate(request);
    cors.headers.set("Cache-Control", "private, no-store");
    return Response.json(
      { data: { userId: context.userId } },
      { headers: cors.headers },
    );
  } catch (error) {
    const authError =
      error instanceof AuthenticationError
        ? error
        : new AuthenticationError("AUTH_PROVIDER_ERROR", { cause: error });
    cors.headers.set("Cache-Control", "private, no-store");
    return Response.json(toAuthErrorBody(authError), {
      status: authError.status,
      headers: cors.headers,
    });
  }
}

export function handleAuthOptions(
  request: Request,
  allowedOrigins = process.env.CORS_ALLOWED_ORIGINS,
): Response {
  const cors = createCorsDecision(request, allowedOrigins);
  return new Response(null, {
    status: cors.allowed ? 204 : 403,
    headers: cors.headers,
  });
}

function productionDependencies(): AuthMeDependencies {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  return {
    authenticate(request) {
      if (!supabaseUrl || !publishableKey) {
        throw new AuthenticationError("AUTH_PROVIDER_ERROR");
      }

      return authenticateRequest(request, { supabaseUrl, publishableKey });
    },
    ...(process.env.CORS_ALLOWED_ORIGINS
      ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS }
      : {}),
  };
}
