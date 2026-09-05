export interface JobBatchResult {
  readonly processed: number;
  readonly failed: number;
  readonly archived: number;
}

export const EMPTY_JOB_RESULT: JobBatchResult = {
  processed: 0,
  failed: 0,
  archived: 0,
};

export function mergeJobResults(
  left: JobBatchResult,
  right: JobBatchResult,
): JobBatchResult {
  return {
    processed: left.processed + right.processed,
    failed: left.failed + right.failed,
    archived: left.archived + right.archived,
  };
}
