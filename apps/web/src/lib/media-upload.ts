import type { MediaUploadAuthorizationDto } from "@iride/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadAuthorizedMedia(
  authorization: MediaUploadAuthorizationDto,
  blob: Blob,
  client: Pick<SupabaseClient, "storage">,
): Promise<void> {
  const expiry = Date.parse(authorization.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now())
    throw new Error("MEDIA_UPLOAD_EXPIRED");
  const { error } = await client.storage
    .from(authorization.bucketId)
    .uploadToSignedUrl(
      authorization.objectPath,
      authorization.uploadToken,
      blob,
      { contentType: blob.type, upsert: false },
    );
  if (error) throw new Error("MEDIA_UPLOAD_FAILED", { cause: error });
}
