import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class TripReturnRoutes20260926100000 implements MigrationInterface {
  readonly name = "TripReturnRoutes20260926100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn("public.events", "return_destination"))
      return;
    const sql = await readFile(
      new URL(
        "../../../../../supabase/migrations/20260926100000_trip_return_routes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await queryRunner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error(
      "Trip return routes cannot be rolled back without losing user data. Use a forward migration.",
    );
  }
}
