import { createAdminDatabaseClient } from "@iride/database/admin";
import { QUEUE_NAMES, QUEUE_POLICIES, type Json } from "@iride/database";
import { createR2Storage } from "@iride/storage";
import type { WorkerEnv } from "@iride/config/worker";

import { processMediaJob, type MediaProcessingJob } from "./media-processor";

interface QueueMessage { readonly messageId:number; readonly readCount:number; readonly message:MediaProcessingJob|null }
export interface MediaWorkerDependencies { readonly queue:{read:()=>Promise<readonly QueueMessage[]>;archive:(id:number)=>Promise<void>}; readonly process:(message:MediaProcessingJob)=>Promise<void> }

export async function runMediaBatch(dependencies:MediaWorkerDependencies){
  const jobs=await dependencies.queue.read();
  for(const job of jobs){
    if(!job.message){
      console.error(JSON.stringify({level:"error",event:"media_job_invalid",messageId:job.messageId}));
      await dependencies.queue.archive(job.messageId);
      continue;
    }
    try{await dependencies.process(job.message);await dependencies.queue.archive(job.messageId)}catch(error){
      console.error(JSON.stringify({level:"error",event:"media_job_failed",jobId:job.message.jobId,mediaId:job.message.mediaId,readCount:job.readCount,message:error instanceof Error?error.message:"unknown"}));
      if(job.readCount>=QUEUE_POLICIES.MEDIA_PROCESSING.maxAttempts)await dependencies.queue.archive(job.messageId);
    }
  }
  return jobs.length;
}

export function createMediaWorkerDependencies(env:WorkerEnv):MediaWorkerDependencies{
  const admin=createAdminDatabaseClient({url:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const storage=createR2Storage({accountId:env.CLOUDFLARE_ACCOUNT_ID,accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY,bucket:env.R2_BUCKET});
  return{
    queue:{
      async read(){const {data,error}=await admin.rpc("read_jobs",{queue_name:QUEUE_NAMES.MEDIA_PROCESSING,visibility_timeout_seconds:QUEUE_POLICIES.MEDIA_PROCESSING.visibilityTimeoutSeconds,batch_size:2});if(error)throw error;return(data??[]).map((row)=>({messageId:row.msg_id,readCount:row.read_ct,message:parseMessage(row.message)}))},
      async archive(id){const {error}=await admin.rpc("archive_job",{queue_name:QUEUE_NAMES.MEDIA_PROCESSING,message_id:id});if(error)throw error},
    },
    async process(message){
      await admin.from("media").update({status:"processing",failure_reason:null}).eq("id",message.mediaId).eq("owner_id",message.ownerId).in("status",["processing","failed"]);
      await processMediaJob(message,{storage,repository:{
        async markReady(mediaId,value){const {error}=await admin.rpc("finish_media_processing",{target_media_id:mediaId,source_width:value.width,source_height:value.height,variants:value.variants.map((item)=>({kind:item.kind,object_key:item.objectKey,bytes:item.bytes,width:item.width,height:item.height})) as unknown as Json});if(error)throw error},
        async markFailed(mediaId,reason){const {error}=await admin.from("media").update({status:"failed",failure_reason:reason}).eq("id",mediaId).eq("status","processing");if(error)throw error},
      }});
    },
  };
}

function parseMessage(value:Json):MediaProcessingJob|null{
  if(typeof value!=="object"||value===null||Array.isArray(value))return null;
  const item=value as Record<string,Json|undefined>;
  const allowedPurposes=["avatar","cover","vehicle"] as const;
  if(item.version!==1||typeof item.jobId!=="string"||typeof item.idempotencyKey!=="string"||typeof item.attempt!=="number"||typeof item.mediaId!=="string"||typeof item.ownerId!=="string"||typeof item.objectKey!=="string"||!(["avatar","cover","vehicle","market"] as const).includes(item.purpose as never))return null;
  if (!allowedPurposes.includes(item.purpose as never)) return null;
  return{version:1,jobId:item.jobId,idempotencyKey:item.idempotencyKey,attempt:item.attempt,mediaId:item.mediaId,ownerId:item.ownerId,purpose:item.purpose as MediaProcessingJob["purpose"],objectKey:item.objectKey};
}

export function startMediaWorker(dependencies:MediaWorkerDependencies){
  let stopped=false;let timer:NodeJS.Timeout|undefined;
  const tick=async()=>{if(stopped)return;try{await runMediaBatch(dependencies)}catch(error){console.error(JSON.stringify({level:"error",event:"media_worker_poll_failed",message:error instanceof Error?error.message:"unknown"}))}finally{if(!stopped)timer=setTimeout(tick,2000)}};
  void tick();return()=>{stopped=true;if(timer)clearTimeout(timer)};
}
