import { getVerifiedWebSession } from "@/lib/auth-session";

type RouteContext = { readonly params: Promise<{ readonly path: readonly string[] }> };

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  if (!path.length || path.some((segment) => !segment || segment === "." || segment === "..")) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Route was not found." } },
      { status: 404 },
    );
  }

  const incomingUrl = new URL(request.url);
  const apiBase = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const target = new URL(`/api/v1/${path.map(encodeURIComponent).join("/")}`, apiBase);
  target.search = incomingUrl.search;
  const session = await getVerifiedWebSession().catch(() => null);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (session) headers.set("authorization", `Bearer ${session.accessToken}`);
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, {
    method,
    headers,
    cache: "no-store",
    ...(body === undefined || body.byteLength === 0 ? {} : { body }),
  });
  const responseHeaders = new Headers();
  for (const name of ["content-type", "cache-control", "etag", "location"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
