import { handleGetPublicProfile, handleProfileOptions } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ username: string }> },
) {
  const { username } = await params;
  return handleGetPublicProfile(request, username);
}

export function OPTIONS(request: Request) {
  return handleProfileOptions(request);
}
