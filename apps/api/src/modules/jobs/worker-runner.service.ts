import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";

import { JobDrainService } from "./job-drain.service";

export const WORKER_RUNNER_ENABLED = "WORKER_RUNNER_ENABLED";

@Injectable()
export class WorkerRunnerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private stopped = false;
  private timer: NodeJS.Timeout | undefined;
  private active: Promise<void> | undefined;

  constructor(
    @Inject(JobDrainService) private readonly jobs: JobDrainService,
    @Inject(WORKER_RUNNER_ENABLED) private readonly enabled: boolean,
  ) {}

  onApplicationBootstrap(): void {
    if (this.enabled) this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.active;
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.active = this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    try {
      await this.jobs.drain({ deadlineMs: 45_000, batchSizePerQueue: 2 });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "worker_poll_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    } finally {
      this.active = undefined;
      if (!this.stopped) this.schedule(2_000);
    }
  }
}
