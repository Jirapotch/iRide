import { handleContentOptions, handleExplore } from "@/lib/content";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleExplore(request);
}

export function OPTIONS(request: Request) {
  return handleContentOptions(request);
}
