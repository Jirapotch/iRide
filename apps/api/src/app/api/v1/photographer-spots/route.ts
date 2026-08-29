import { handleContentCollection, handleContentOptions } from "@/lib/content";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleContentCollection(request, "photographer-spots");
}

export function POST(request: Request) {
  return handleContentCollection(request, "photographer-spots");
}

export function OPTIONS(request: Request) {
  return handleContentOptions(request);
}
