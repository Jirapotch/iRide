import { handleContentOptions, handleSearch } from "@/lib/content";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleSearch(request);
}

export function OPTIONS(request: Request) {
  return handleContentOptions(request);
}
