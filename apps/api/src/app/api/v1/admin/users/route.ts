import { handleAdminUsers, handleAdminUsersOptions } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleAdminUsers(request);
}

export function OPTIONS(request: Request) {
  return handleAdminUsersOptions(request);
}
