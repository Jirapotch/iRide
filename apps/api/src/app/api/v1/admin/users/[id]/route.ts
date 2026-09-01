import { handleAdminUser, handleAdminUsersOptions } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

type Context = { readonly params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleAdminUser(request, (await params).id);
}

export async function PATCH(request: Request, { params }: Context) {
  return handleAdminUser(request, (await params).id);
}

export function OPTIONS(request: Request) {
  return handleAdminUsersOptions(request);
}
