import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class RecapMediaPurpose20260926102000 implements MigrationInterface {
  readonly name = "RecapMediaPurpose20260926102000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const sql = await readFile(
      new URL(
        "../../../../../supabase/migrations/20260926102000_recap_media_purpose.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await queryRunner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error(
      "Recap media purpose cannot be rolled back. Use a forward migration.",
    );
  }
}
