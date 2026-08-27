import { handleAuthMe, handleAuthOptions } from "@/lib/auth-me";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleAuthMe(request);
}

export function OPTIONS(request: Request) {
  return handleAuthOptions(request);
}
