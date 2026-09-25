import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class RideGroups20260926101000 implements MigrationInterface {
  readonly name = "RideGroups20260926101000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("public.ride_groups")) return;
    const sql = await readFile(
      new URL(
        "../../../../../supabase/migrations/20260926101000_ride_groups.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await queryRunner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error(
      "Ride groups cannot be rolled back without losing user data. Use a forward migration.",
    );
  }
}
