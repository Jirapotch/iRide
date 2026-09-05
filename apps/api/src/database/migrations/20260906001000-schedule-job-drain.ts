import type { MigrationInterface, QueryRunner } from "typeorm";

export class ScheduleJobDrain20260906001000 implements MigrationInterface {
  readonly name = "ScheduleJobDrain20260906001000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create extension if not exists pg_cron with schema pg_catalog;
      create extension if not exists pg_net with schema extensions;

      do $$
      begin
        if exists (select 1 from cron.job where jobname = 'iride-drain-jobs') then
          perform cron.unschedule('iride-drain-jobs');
        end if;
      end
      $$;

      select cron.schedule(
        'iride-drain-jobs',
        '* * * * *',
        $job$
          select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name = 'iride_job_drain_url'),
            headers := jsonb_build_object(
              'Authorization',
              'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'iride_worker_cron_secret')
            )
          );
        $job$
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      do $$
      begin
        if exists (select 1 from cron.job where jobname = 'iride-drain-jobs') then
          perform cron.unschedule('iride-drain-jobs');
        end if;
      end
      $$;
    `);
  }
}
