import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

export function toWebRequest(request: ExpressRequest): Request {
  const host = request.get("host") ?? "localhost";
  const url = new URL(request.originalUrl, `${request.protocol}://${host}`);
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const method = request.method.toUpperCase();
  const rawBody = method === "GET" || method === "HEAD" ? undefined : request.body;
  const body =
    rawBody === undefined
      ? undefined
      : typeof rawBody === "string"
        ? rawBody
        : JSON.stringify(rawBody);
  return new Request(url, {
    method,
    headers,
    ...(body === undefined
      ? {}
      : { body }),
  });
}

export async function sendWebResponse(
  target: ExpressResponse,
  source: Response,
): Promise<void> {
  target.status(source.status);
  source.headers.forEach((value, name) => target.setHeader(name, value));
  const body = Buffer.from(await source.arrayBuffer());
  if (body.length === 0) {
    target.end();
    return;
  }
  target.send(body);
}
