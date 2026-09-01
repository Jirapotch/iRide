import { describe, expect, it, vi } from "vitest";

import { handleMediaComplete, handleMediaUpload, handleMediaVariant, type MediaDependencies } from "./media";

const userId="10000000-0000-4000-8000-000000000001";
const mediaId="20000000-0000-4000-8000-000000000001";
const key=`users/${userId}/avatar/${mediaId}/original`;

function setup():MediaDependencies{
  return{
    authenticate:vi.fn().mockResolvedValue({userId,accessTokenClaims:{}}),
    newId:()=>mediaId,
    repository:{
      getAccountAccess:vi.fn().mockResolvedValue({status:"active",transitionId:null}),
      createUpload:vi.fn().mockResolvedValue(undefined),
      findOwnedUpload:vi.fn().mockResolvedValue({id:mediaId,ownerId:userId,purpose:"avatar",status:"uploading",objectKey:key,mimeType:"image/webp",bytes:1024}),
      markProcessingAndEnqueue:vi.fn().mockResolvedValue(undefined),
      findDeliverableVariant:vi.fn().mockResolvedValue({objectKey:`users/${userId}/avatar/${mediaId}/preview.webp`}),
    },
    storage:{
      signUpload:vi.fn().mockResolvedValue("https://upload.test/signed"),
      head:vi.fn().mockResolvedValue({bytes:1024,contentType:"image/webp"}),
      signDownload:vi.fn().mockResolvedValue("https://download.test/signed"),
    },
  };
}

describe("media API handlers",()=>{
  it("authorizes a bounded direct upload without exposing an object key",async()=>{
    const dependencies=setup();
    const response=await handleMediaUpload(new Request("https://api.test/media/uploads",{method:"POST",headers:{authorization:"Bearer signed.jwt","content-type":"application/json"},body:JSON.stringify({filename:"avatar.webp",mimeType:"image/webp",bytes:1024,purpose:"avatar"})}),dependencies);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({data:{mediaId,uploadUrl:"https://upload.test/signed",headers:{"content-type":"image/webp"},expiresAt:expect.any(String)}});
    expect(dependencies.repository.createUpload).toHaveBeenCalledWith(expect.objectContaining({id:mediaId,ownerId:userId,objectKey:key}),"signed.jwt");
  });

  it.each(["locked", "suspended"] as const)("does not authorize uploads for %s accounts",async(status)=>{
    const dependencies=setup() as MediaDependencies & {repository: MediaDependencies["repository"] & {getAccountAccess:(userId:string)=>Promise<unknown>}};
    dependencies.repository.getAccountAccess=vi.fn().mockResolvedValue({status,transitionId:null});

    const response=await handleMediaUpload(new Request("https://api.test/media/uploads",{method:"POST",headers:{authorization:"Bearer signed.jwt","content-type":"application/json"},body:JSON.stringify({filename:"avatar.webp",mimeType:"image/webp",bytes:1024,purpose:"avatar"})}),dependencies);

    expect(response.status).toBe(403);
    expect(dependencies.repository.createUpload).not.toHaveBeenCalled();
  });

  it("does not complete an upload after the owner is suspended",async()=>{
    const dependencies=setup() as MediaDependencies & {repository: MediaDependencies["repository"] & {getAccountAccess:(userId:string)=>Promise<unknown>}};
    dependencies.repository.getAccountAccess=vi.fn().mockResolvedValue({status:"suspended",transitionId:null});

    const response=await handleMediaComplete(new Request(`https://api.test/media/${mediaId}/complete`,{method:"POST",headers:{authorization:"Bearer signed.jwt"}}),mediaId,dependencies);

    expect(response.status).toBe(403);
    expect(dependencies.repository.markProcessingAndEnqueue).not.toHaveBeenCalled();
  });

  it("does not authorize an upload during a pending restore",async()=>{
    const dependencies=setup() as MediaDependencies & {repository: MediaDependencies["repository"] & {getAccountAccess:(userId:string)=>Promise<unknown>}};
    dependencies.repository.getAccountAccess=vi.fn().mockResolvedValue({status:"active",transitionId:"33333333-3333-4333-8333-333333333333"});

    const response=await handleMediaUpload(new Request("https://api.test/media/uploads",{method:"POST",headers:{authorization:"Bearer signed.jwt","content-type":"application/json"},body:JSON.stringify({filename:"avatar.webp",mimeType:"image/webp",bytes:1024,purpose:"avatar"})}),dependencies);

    expect(response.status).toBe(403);
    expect(dependencies.repository.createUpload).not.toHaveBeenCalled();
  });

  it("verifies R2 metadata before atomically enqueueing processing",async()=>{
    const dependencies=setup();
    const response=await handleMediaComplete(new Request(`https://api.test/media/${mediaId}/complete`,{method:"POST",headers:{authorization:"Bearer signed.jwt"}}),mediaId,dependencies);
    expect(response.status).toBe(202);
    expect(dependencies.repository.markProcessingAndEnqueue).toHaveBeenCalledWith(userId,mediaId,expect.objectContaining({version:1,mediaId,objectKey:key}));
  });

  it("rejects completion when uploaded bytes do not match",async()=>{
    const dependencies=setup();
    vi.mocked(dependencies.storage.head).mockResolvedValue({bytes:1000,contentType:"image/webp"});
    const response=await handleMediaComplete(new Request(`https://api.test/media/${mediaId}/complete`,{method:"POST",headers:{authorization:"Bearer signed.jwt"}}),mediaId,dependencies);
    expect(response.status).toBe(400);
    expect(dependencies.repository.markProcessingAndEnqueue).not.toHaveBeenCalled();
  });

  it("redirects an authorized variant to a short-lived signed URL",async()=>{
    const dependencies=setup();
    const response=await handleMediaVariant(new Request(`https://api.test/media/${mediaId}/variants/preview`),mediaId,"preview",dependencies);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://download.test/signed");
  });
});
