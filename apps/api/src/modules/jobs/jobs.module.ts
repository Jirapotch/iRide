import { Module } from "@nestjs/common";

import { InternalJobsController } from "./internal-jobs.controller";
import { JobDrainService } from "./job-drain.service";

@Module({ controllers: [InternalJobsController], providers: [JobDrainService], exports: [JobDrainService] })
export class JobsModule {}
