import { Injectable } from "@nestjs/common";
import { getWorkerEnv } from "@iride/config/worker";

import {
  createMediaCleanupJobDependencies,
  runMediaCleanupBatch,
} from "../../jobs/media-cleanup.job";
import {
  createMediaProcessingJobDependencies,
  runMediaProcessingBatch,
} from "../../jobs/media-processing.job";
import { EMPTY_JOB_RESULT, mergeJobResults, type JobBatchResult } from "../../jobs/job-result";

@Injectable()
export class JobDrainService {
  async drain(options: {
    readonly deadlineMs: number;
    readonly batchSizePerQueue: number;
  }): Promise<JobBatchResult> {
    const env = getWorkerEnv();
    const deadline = Date.now() + options.deadlineMs;
    const shouldContinue = () => Date.now() < deadline;
    let result = EMPTY_JOB_RESULT;

    if (shouldContinue()) {
      result = mergeJobResults(
        result,
        await runMediaProcessingBatch(createMediaProcessingJobDependencies(env), {
          batchSize: options.batchSizePerQueue,
          shouldContinue,
        }),
      );
    }
    if (shouldContinue()) {
      result = mergeJobResults(
        result,
        await runMediaCleanupBatch(createMediaCleanupJobDependencies(env), {
          batchSize: options.batchSizePerQueue,
          shouldContinue,
        }),
      );
    }
    return result;
  }
}
