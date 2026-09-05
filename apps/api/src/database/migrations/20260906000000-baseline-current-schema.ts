import type { MigrationInterface, QueryRunner } from "typeorm";

export class BaselineCurrentSchema20260906000000 implements MigrationInterface {
  readonly name = "BaselineCurrentSchema20260906000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      do $$
      begin
        if to_regnamespace('public') is null or to_regnamespace('private') is null then
          raise exception 'iRide baseline is missing required public/private schemas';
        end if;

        if to_regclass('public.profiles') is null
          or to_regclass('public.posts') is null
          or to_regclass('public.events') is null
          or to_regclass('public.vehicles') is null
          or to_regclass('public.media') is null then
          raise exception 'iRide baseline is missing one or more required tables';
        end if;

        if to_regprocedure('public.read_jobs(text,integer,integer)') is null
          or to_regprocedure('public.archive_job(text,bigint)') is null then
          raise exception 'iRide baseline is missing pgmq service functions';
        end if;

        if to_regclass('pgmq.q_media_processing') is null
          or to_regclass('pgmq.q_media_cleanup') is null then
          raise exception 'iRide baseline is missing required pgmq queues';
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    // Verification-only baseline: historical Supabase migrations remain authoritative.
  }
}
