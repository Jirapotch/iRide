import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class DigitalGarage20261004120000 implements MigrationInterface {
  readonly name = "DigitalGarage20261004120000";
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("public.vehicle_transfers")) return;
    const sql = await readFile(
      new URL(
        "../../../../../supabase/migrations/20261004120000_digital_garage.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await queryRunner.query(sql);
  }
  async down(): Promise<void> {
    throw new Error(
      "Digital garage contains ownership and private document history. Use a forward migration.",
    );
  }
}
