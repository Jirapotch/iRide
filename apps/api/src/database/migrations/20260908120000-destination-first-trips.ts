import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class DestinationFirstTrips20260908120000 implements MigrationInterface {
  readonly name = "DestinationFirstTrips20260908120000";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Local Supabase resets already apply the authoritative SQL migration.
    if (await queryRunner.hasColumn("public.events", "stops")) return;
    const sql = await readFile(
      new URL(
        "../../../../../supabase/migrations/20260908120000_destination_first_trips.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await queryRunner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error(
      "Destination-only trips cannot be rolled back without losing user data. Use a forward migration.",
    );
  }
}
