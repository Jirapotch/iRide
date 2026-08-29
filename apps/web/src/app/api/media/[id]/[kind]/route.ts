import { NextResponse } from "next/server";

import { getVerifiedWebSession } from "@/lib/auth-session";

export async function GET(_request: Request, { params }: { readonly params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || (kind !== "thumbnail" && kind !== "preview")) {
    return NextResponse.json({ error: { code: "MEDIA_NOT_FOUND" } }, { status: 404 });
  }
  const session = await getVerifiedWebSession().catch(() => null);
  const base = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "http://localhost:3001";
  const response = await fetch(`${base}/api/v1/media/${encodeURIComponent(id)}/variants/${kind}`, {
    cache: "no-store",
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
    redirect: "manual",
  });
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) return NextResponse.redirect(location, 307);
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}
