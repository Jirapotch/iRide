import { Module } from "@nestjs/common";

import { JobsModule } from "./modules/jobs/jobs.module";
import { WORKER_RUNNER_ENABLED, WorkerRunnerService } from "./modules/jobs/worker-runner.service";
import { WorkerHealthController } from "./modules/jobs/worker-health.controller";

@Module({
  imports: [JobsModule],
  controllers: [WorkerHealthController],
  providers: [
    WorkerRunnerService,
    { provide: WORKER_RUNNER_ENABLED, useValue: true },
  ],
})
export class WorkerModule {}
