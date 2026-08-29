import { randomUUID } from "node:crypto";

import { authenticateRequest, AuthenticationError, parseBearerToken, toAuthErrorBody, type AuthContext } from "@iride/auth";
import { createR2Storage, mediaObjectKey } from "@iride/storage";
import type { MediaPurpose, MediaStatus, MediaUploadRequest, MediaVariantKind } from "@iride/types";
import { mediaUploadRequestSchema } from "@iride/validation";

import { createCorsDecision } from "./cors";
import { createMediaRepository } from "./media-repository";

interface OwnedUpload { readonly id:string; readonly ownerId:string; readonly purpose:MediaPurpose; readonly status:MediaStatus; readonly objectKey:string; readonly mimeType:string; readonly bytes:number }
interface ProcessingMessage { readonly version:1; readonly jobId:string; readonly idempotencyKey:string; readonly attempt:0; readonly mediaId:string; readonly ownerId:string; readonly purpose:MediaPurpose; readonly objectKey:string }
export interface MediaRepository {
  readonly createUpload:(input:{id:string;ownerId:string;purpose:MediaPurpose;objectKey:string;filename:string;mimeType:string;bytes:number},token:string)=>Promise<void>;
  readonly findOwnedUpload:(userId:string,id:string)=>Promise<OwnedUpload|null>;
  readonly markProcessingAndEnqueue:(userId:string,id:string,message:ProcessingMessage)=>Promise<void>;
  readonly findDeliverableVariant:(id:string,kind:MediaVariantKind,viewerId:string|null)=>Promise<{objectKey:string}|null>;
}
export interface MediaDependencies {
  readonly authenticate:(request:Pick<Request,"headers">)=>Promise<AuthContext>;
  readonly newId:()=>string;
  readonly repository:MediaRepository;
  readonly storage:{signUpload:(key:string,mime:string,bytes:number,expires?:number)=>Promise<string>;head:(key:string)=>Promise<{bytes:number;contentType:string|null}>;signDownload:(key:string,expires?:number)=>Promise<string>};
  readonly allowedOrigins?:string;
}
class MediaError extends Error { constructor(readonly code:string,readonly status:number){super(code)} }

export function handleMediaUpload(request:Request,dependencies=productionDependencies()){
  return execute(request,dependencies,async()=>{
    if(request.method!=="POST")return methodNotAllowed();
    const auth=await dependencies.authenticate(request);const input=await read<MediaUploadRequest>(request,mediaUploadRequestSchema);
    const id=dependencies.newId();const objectKey=mediaObjectKey(auth.userId,input.purpose,input.filename,id);
    await dependencies.repository.createUpload({id,ownerId:auth.userId,purpose:input.purpose,objectKey,filename:input.filename,mimeType:input.mimeType,bytes:input.bytes},bearer(request));
    const uploadUrl=await dependencies.storage.signUpload(objectKey,input.mimeType,input.bytes,300);
    return Response.json({data:{mediaId:id,uploadUrl,headers:{"content-type":input.mimeType},expiresAt:new Date(Date.now()+300_000).toISOString()}},{status:201});
  });
}

export function handleMediaComplete(request:Request,id:string,dependencies=productionDependencies()){
  return execute(request,dependencies,async()=>{
    requireUuid(id);if(request.method!=="POST")return methodNotAllowed();
    const auth=await dependencies.authenticate(request);const media=await dependencies.repository.findOwnedUpload(auth.userId,id);
    if(!media)throw new MediaError("MEDIA_NOT_FOUND",404);
    if(media.status==="processing"||media.status==="ready")return Response.json({data:{mediaId:id,status:media.status}},{status:202});
    if(media.status!=="uploading")throw new MediaError("MEDIA_UPLOAD_INVALID",400);
    const object=await dependencies.storage.head(media.objectKey);
    if(object.bytes!==media.bytes||object.contentType!==media.mimeType)throw new MediaError("MEDIA_UPLOAD_INVALID",400);
    const message:ProcessingMessage={version:1,jobId:randomUUID(),idempotencyKey:`media:${id}:process`,attempt:0,mediaId:id,ownerId:auth.userId,purpose:media.purpose,objectKey:media.objectKey};
    await dependencies.repository.markProcessingAndEnqueue(auth.userId,id,message);
    return Response.json({data:{mediaId:id,status:"processing"}},{status:202});
  });
}

export function handleMediaVariant(request:Request,id:string,kind:string,dependencies=productionDependencies()){
  return execute(request,dependencies,async()=>{
    requireUuid(id);if(request.method!=="GET")return methodNotAllowed();if(kind!=="thumbnail"&&kind!=="preview")throw new MediaError("MEDIA_NOT_FOUND",404);
    const viewer=await optionalViewer(request,dependencies);const variant=await dependencies.repository.findDeliverableVariant(id,kind,viewer);
    if(!variant)throw new MediaError("MEDIA_NOT_FOUND",404);
    return new Response(null,{status:307,headers:{Location:await dependencies.storage.signDownload(variant.objectKey,120)}});
  });
}
export function handleMediaOptions(request:Request,allowed=process.env.CORS_ALLOWED_ORIGINS){const cors=createCorsDecision(request,allowed,"GET, POST, OPTIONS");return new Response(null,{status:cors.allowed?204:403,headers:cors.headers})}

async function execute(request:Request,dependencies:MediaDependencies,operation:()=>Promise<Response>){
  const cors=createCorsDecision(request,dependencies.allowedOrigins,"GET, POST, OPTIONS");if(!cors.allowed)return error("CONTENT_FORBIDDEN",403,cors.headers);
  try{const response=await operation();cors.headers.forEach((value,key)=>response.headers.set(key,value));return response}catch(reason){
    if(reason instanceof AuthenticationError)return Response.json(toAuthErrorBody(reason),{status:reason.status,headers:cors.headers});
    const item=reason as {code?:string;status?:number};return error(item.code??"MEDIA_UNAVAILABLE",item.status??503,cors.headers);
  }
}
async function read<T>(request:Request,schema:{safeParse:(value:unknown)=>{success:true;data:unknown}|{success:false}}){let body:unknown;try{body=await request.json()}catch{throw new MediaError("MEDIA_VALIDATION_FAILED",400)}const result=schema.safeParse(body);if(!result.success)throw new MediaError("MEDIA_VALIDATION_FAILED",400);return result.data as T}
async function optionalViewer(request:Request,deps:MediaDependencies){return request.headers.has("authorization")?(await deps.authenticate(request)).userId:null}
function bearer(request:Request){return parseBearerToken(request.headers.get("authorization"))}
function requireUuid(value:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new MediaError("MEDIA_NOT_FOUND",404)}
function error(code:string,status:number,headers?:Headers){return Response.json({error:{code,message:code}},{status,...(headers?{headers}:{})})}
function methodNotAllowed(){return error("METHOD_NOT_ALLOWED",405)}

function productionDependencies():MediaDependencies{
  const url=process.env.SUPABASE_URL?.trim(),publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const accountId=process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),accessKeyId=process.env.R2_ACCESS_KEY_ID?.trim(),secretAccessKey=process.env.R2_SECRET_ACCESS_KEY?.trim(),bucket=process.env.R2_BUCKET?.trim();
  if(!url||!publishableKey||!serviceRoleKey||!accountId||!accessKeyId||!secretAccessKey||!bucket){const unavailable=async():Promise<never>=>{throw new MediaError("MEDIA_UNAVAILABLE",503)};return{authenticate:unavailable,newId:randomUUID,repository:new Proxy({},{get:()=>unavailable}) as MediaRepository,storage:{signUpload:unavailable,head:unavailable,signDownload:unavailable}}}
  return{authenticate:(request)=>authenticateRequest(request,{supabaseUrl:url,publishableKey}),newId:randomUUID,repository:createMediaRepository({url,publishableKey,serviceRoleKey}),storage:createR2Storage({accountId,accessKeyId,secretAccessKey,bucket}),...(process.env.CORS_ALLOWED_ORIGINS?{allowedOrigins:process.env.CORS_ALLOWED_ORIGINS}:{})};
}
