import { handleAdminModeration, handleAdminModerationOptions } from "@/lib/admin-moderation";

export const dynamic = "force-dynamic";

export function DELETE(request: Request) {
  return handleAdminModeration(request);
}

export function OPTIONS(request: Request) {
  return handleAdminModerationOptions(request);
}
