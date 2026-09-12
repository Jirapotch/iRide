import { readFile } from "node:fs/promises";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class MediaSourceRetention20260912162442 implements MigrationInterface {
  readonly name = "MediaSourceRetention20260912162442";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      await readFile(
        new URL(
          "../../../../../supabase/migrations/20260912162442_media_source_retention.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }

  async down(): Promise<void> {
    throw new Error(
      "Source deletion cannot be undone. Use a forward migration.",
    );
  }
}
