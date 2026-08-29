import { handleContentCollection, handleContentOptions } from "@/lib/content";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleContentCollection(request, "events");
}

export function POST(request: Request) {
  return handleContentCollection(request, "events");
}

export function OPTIONS(request: Request) {
  return handleContentOptions(request);
}
