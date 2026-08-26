import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createTransitionalMediaStorage,
  getR2MediaStorage,
  mediaTtlSeconds,
  type MediaBucket,
} from "@/lib/media-storage";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function createLegacyMediaStorage(supabase: SupabaseClient) {
  return {
    async remove(bucket: MediaBucket, key: string) {
      const { error } = await supabase.storage.from(bucket).remove([key]);
      if (error) throw error;
    },

    async urls(bucket: MediaBucket, keys: string[]) {
      const uniqueKeys = [...new Set(keys)];
      if (!uniqueKeys.length) return new Map<string, string>();

      if (bucket !== "post-media") {
        return new Map(uniqueKeys.map((key) => [
          key,
          supabase.storage.from(bucket).getPublicUrl(key).data.publicUrl,
        ]));
      }

      const admin = createAdminClient();
      if (!admin) return new Map<string, string>();
      const { data, error } = await admin.storage.from(bucket).createSignedUrls(uniqueKeys, mediaTtlSeconds(bucket));
      if (error) throw error;
      const entries: Array<readonly [string, string]> = [];
      data.forEach((item, index) => {
        if (item.signedUrl) entries.push([uniqueKeys[index], item.signedUrl]);
      });
      return new Map(entries);
    },
  };
}

export function getTransitionalMediaStorage(supabase: SupabaseClient) {
  return createTransitionalMediaStorage(getR2MediaStorage(), createLegacyMediaStorage(supabase));
}
