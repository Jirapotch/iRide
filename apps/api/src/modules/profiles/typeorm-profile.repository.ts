import type { Tables } from "@iride/database/types";
import type { UpdateProfileInput } from "@iride/types";
import { normalizeUsername } from "@iride/validation";
import { Injectable } from "@nestjs/common";

import {
  withActorTransaction,
  type ActorContext,
} from "../../database/actor-transaction";
import { RuntimeDatabaseService } from "../../database/runtime-database.service";
import type { ProfileRepository } from "../../lib/profiles";

type ProfileRow = Tables<"profiles">;
type AccessRow = Tables<"account_access">;

const profileColumns = [
  "username",
  "display_name",
  "bio",
  "location_name",
  "latitude",
  "longitude",
  "visibility",
  "avatar_media_id",
  "cover_media_id",
] as const;

@Injectable()
export class TypeOrmProfileRepository implements ProfileRepository {
  constructor(private readonly database: RuntimeDatabaseService) {}

  getById(userId: string): Promise<ProfileRow | null> {
    return this.one<ProfileRow>(
      { role: "service_role" },
      "select * from public.profiles where id = $1 limit 1",
      [userId],
    );
  }

  getByUsername(username: string): Promise<ProfileRow | null> {
    return this.one<ProfileRow>(
      { role: "service_role" },
      "select * from public.profiles where username = $1 limit 1",
      [normalizeUsername(username)],
    );
  }

  getAccessByUserId(userId: string): Promise<AccessRow | null> {
    return this.one<AccessRow>(
      { role: "service_role" },
      "select * from public.account_access where user_id = $1 limit 1",
      [userId],
    );
  }

  async updateOwner(
    userId: string,
    _accessToken: string,
    input: UpdateProfileInput,
  ): Promise<void> {
    await withActorTransaction(
      this.database,
      { role: "authenticated", userId },
      async (manager) => {
        for (const [mediaId, purpose] of [
          [input.avatarMediaId, "avatar"],
          [input.coverMediaId, "cover"],
        ] as const) {
          if (!mediaId) continue;
          const rows = await manager.query<{ id: string }[]>(
            "select id from public.media where id = $1 and owner_id = $2 and purpose = $3 and status = 'ready' and deleted_at is null limit 1",
            [mediaId, userId, purpose],
          );
          if (!rows[0]) {
            throw Object.assign(new Error("PROFILE_MEDIA_FORBIDDEN"), {
              code: "42501",
            });
          }
        }

        const values = profileUpdateValues(input);
        if (values.length === 0) return;
        const assignments = values.map(
          ([column], index) => `${column} = $${index + 1}`,
        );
        await manager.query(
          `update public.profiles set ${assignments.join(", ")} where id = $${values.length + 1}`,
          [...values.map(([, value]) => value), userId],
        );
      },
    );
  }

  private one<Row>(
    actor: ActorContext,
    sql: string,
    parameters: readonly unknown[],
  ): Promise<Row | null> {
    return withActorTransaction(this.database, actor, async (manager) => {
      const rows = await manager.query<Row[]>(sql, [...parameters]);
      return rows[0] ?? null;
    });
  }
}

function profileUpdateValues(
  input: UpdateProfileInput,
): Array<readonly [string, unknown]> {
  const candidate: Record<(typeof profileColumns)[number], unknown> = {
    username: input.username,
    display_name: input.displayName,
    bio: input.bio,
    location_name: input.locationName,
    latitude: input.latitude,
    longitude: input.longitude,
    visibility: input.visibility,
    avatar_media_id: input.avatarMediaId,
    cover_media_id: input.coverMediaId,
  };
  return profileColumns.flatMap((column) =>
    candidate[column] === undefined
      ? []
      : ([[column, candidate[column]]] as const),
  );
}
