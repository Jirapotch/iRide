import { NextResponse } from "next/server";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getExploreContent } from "@/lib/content-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bbox = url.searchParams.get("bbox")?.split(",").map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
    return NextResponse.json({ error: "INVALID_BBOX" }, { status: 400 });
  }
  const session = await getVerifiedWebSession().catch(() => null);
  try {
    const data = await getExploreContent(bbox as [number, number, number, number], (url.searchParams.get("layers") ?? "events,trips").split(","), undefined, session?.accessToken);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "EXPLORE_UNAVAILABLE" }, { status: 503 });
  }
}
