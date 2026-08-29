import { describe, expect, it, vi } from "vitest";

import { runMediaBatch, type MediaWorkerDependencies } from "./media-worker";

const message={version:1,jobId:"job-1",idempotencyKey:"media:m1:process",attempt:0,mediaId:"m1",ownerId:"u1",purpose:"avatar" as const,objectKey:"users/u1/avatar/m1/original"};

describe("media queue worker",()=>{
  it("processes and archives successful jobs",async()=>{
    const dependencies:MediaWorkerDependencies={
      queue:{read:vi.fn().mockResolvedValue([{messageId:1,readCount:1,message}]),archive:vi.fn().mockResolvedValue(undefined)},
      process:vi.fn().mockResolvedValue(undefined),
    };
    expect(await runMediaBatch(dependencies)).toBe(1);
    expect(dependencies.process).toHaveBeenCalledWith(message);
    expect(dependencies.queue.archive).toHaveBeenCalledWith(1);
  });

  it("leaves a retryable failure visible and archives after the fifth read",async()=>{
    const retry:MediaWorkerDependencies={queue:{read:vi.fn().mockResolvedValue([{messageId:1,readCount:2,message}]),archive:vi.fn()},process:vi.fn().mockRejectedValue(new Error("fail"))};
    await runMediaBatch(retry);expect(retry.queue.archive).not.toHaveBeenCalled();
    const terminal:MediaWorkerDependencies={queue:{read:vi.fn().mockResolvedValue([{messageId:2,readCount:5,message}]),archive:vi.fn().mockResolvedValue(undefined)},process:vi.fn().mockRejectedValue(new Error("fail"))};
    await runMediaBatch(terminal);expect(terminal.queue.archive).toHaveBeenCalledWith(2);
  });
});
