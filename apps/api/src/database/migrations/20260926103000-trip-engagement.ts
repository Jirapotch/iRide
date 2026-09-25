import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class TripEngagement20260926103000 implements MigrationInterface {
  readonly name = "TripEngagement20260926103000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("public.trip_participations")) return;
    const sql = await readFile(
      new URL(
        "../../../../../supabase/migrations/20260926103000_trip_engagement.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await queryRunner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error(
      "Trip engagement cannot be rolled back without losing user data. Use a forward migration.",
    );
  }
}
