import { Controller, Headers, HttpCode, HttpException, HttpStatus, Inject, Post } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";

import { JobDrainService } from "./job-drain.service";

@Controller("api/internal/jobs")
export class InternalJobsController {
  constructor(@Inject(JobDrainService) private readonly jobs: JobDrainService) {}

  @Post("drain")
  @HttpCode(HttpStatus.OK)
  async drain(@Headers("authorization") authorization?: string) {
    if (!isAuthorized(authorization, process.env.WORKER_CRON_SECRET)) {
      throw new HttpException(
        { error: { code: "INVALID_CRON_SECRET", message: "Cron authentication failed." } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const result = await this.jobs.drain({
      deadlineMs: 45_000,
      batchSizePerQueue: 2,
    });
    return { data: result };
  }
}

function isAuthorized(header: string | undefined, secret: string | undefined): boolean {
  if (!header?.startsWith("Bearer ") || !secret) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
