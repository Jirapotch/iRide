import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { processMediaJob, type MediaProcessingDependencies, type MediaProcessingJob } from "./media-processor";

const job:MediaProcessingJob={version:1,jobId:"job-1",idempotencyKey:"media:m1:process",attempt:0,mediaId:"m1",ownerId:"u1",purpose:"avatar",objectKey:"users/u1/avatar/m1/original"};

describe("media processor",()=>{
  it("normalizes an image and writes deterministic WebP variants",async()=>{
    const original=await sharp({create:{width:800,height:600,channels:3,background:"#168cff"}}).jpeg().toBuffer();
    const dependencies:MediaProcessingDependencies={
      storage:{get:vi.fn().mockResolvedValue(original),put:vi.fn().mockResolvedValue(undefined)},
      repository:{markReady:vi.fn().mockResolvedValue(undefined),markFailed:vi.fn().mockResolvedValue(undefined)},
    };
    await processMediaJob(job,dependencies);
    expect(dependencies.storage.put).toHaveBeenCalledTimes(2);
    expect(dependencies.storage.put).toHaveBeenCalledWith("users/u1/avatar/m1/thumbnail.webp",expect.any(Uint8Array),"image/webp");
    expect(dependencies.repository.markReady).toHaveBeenCalledWith("m1",expect.objectContaining({width:800,height:600,variants:expect.arrayContaining([expect.objectContaining({kind:"thumbnail",width:256,height:256})])}));
  });

  it("records a stable failure for corrupt input",async()=>{
    const dependencies:MediaProcessingDependencies={
      storage:{get:vi.fn().mockResolvedValue(Buffer.from("not-an-image")),put:vi.fn()},
      repository:{markReady:vi.fn(),markFailed:vi.fn().mockResolvedValue(undefined)},
    };
    await expect(processMediaJob(job,dependencies)).rejects.toThrow("MEDIA_DECODE_FAILED");
    expect(dependencies.repository.markFailed).toHaveBeenCalledWith("m1","MEDIA_DECODE_FAILED");
  });
});
