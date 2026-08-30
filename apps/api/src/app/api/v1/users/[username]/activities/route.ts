import { handleProfileActivities, handleSocialOptions } from "@/lib/social";

interface Context {
  readonly params: Promise<{ username: string }>;
}
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: Context) {
  return handleProfileActivities(request, (await params).username);
}
export async function OPTIONS(request: Request) {
  return handleSocialOptions(request);
}
