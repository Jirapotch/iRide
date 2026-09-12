import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class SupabaseMediaStorage20260912155026 implements MigrationInterface {
  readonly name = "SupabaseMediaStorage20260912155026";

  async up(queryRunner: QueryRunner): Promise<void> {
    // SQL is idempotent so bucket policy and functions are reconciled even after a local reset.
    const sql = await readFile(
      new URL(
        "../../../../../supabase/migrations/20260912155026_supabase_media_storage.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await queryRunner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error(
      "Media storage cannot be rolled back without losing provider and cleanup metadata. Use a forward migration.",
    );
  }
}
