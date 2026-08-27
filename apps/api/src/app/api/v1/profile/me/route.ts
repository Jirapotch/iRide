import {
  handleGetOwnProfile,
  handlePatchOwnProfile,
  handleProfileOptions,
} from "@/lib/profiles";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleGetOwnProfile(request);
}

export function PATCH(request: Request) {
  return handlePatchOwnProfile(request);
}

export function OPTIONS(request: Request) {
  return handleProfileOptions(request);
}
