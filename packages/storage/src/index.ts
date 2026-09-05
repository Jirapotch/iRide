import type { MediaPurpose, MediaVariantKind } from "@iride/types";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageBoundary { readonly provider:"cloudflare-r2"; readonly originals:"private" }
export interface VariantSpec { readonly kind:MediaVariantKind; readonly width:number; readonly height:number; readonly fit:"cover"|"inside" }

export const variantSpecs:Readonly<Record<MediaPurpose,readonly VariantSpec[]>>={
  avatar:[{kind:"thumbnail",width:256,height:256,fit:"cover"},{kind:"preview",width:512,height:512,fit:"cover"}],
  cover:[{kind:"thumbnail",width:600,height:200,fit:"cover"},{kind:"preview",width:1600,height:534,fit:"cover"}],
  vehicle:[{kind:"thumbnail",width:480,height:320,fit:"cover"},{kind:"preview",width:1280,height:960,fit:"inside"}],
};

export function mediaObjectKey(userId:string,purpose:MediaPurpose,_filename:string,mediaId:string){
  return `users/${userId}/${purpose}/${mediaId}/original`;
}

export function mediaVariantObjectKey(userId:string,purpose:MediaPurpose,mediaId:string,kind:MediaVariantKind){
  return `users/${userId}/${purpose}/${mediaId}/${kind}.webp`;
}

export interface R2Config { readonly accountId:string; readonly accessKeyId:string; readonly secretAccessKey:string; readonly bucket:string }
export interface StoredObjectInfo { readonly bytes:number; readonly contentType:string|null }

export function createR2Storage(config:R2Config){
  const client=new S3Client({
    region:"auto",
    endpoint:`https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},
  });
  return {
    async signUpload(key:string,mimeType:string,bytes:number,expiresIn=300){
      const command=new PutObjectCommand({Bucket:config.bucket,Key:key,ContentType:mimeType,ContentLength:bytes});
      return getSignedUrl(client,command,{expiresIn});
    },
    async signDownload(key:string,expiresIn=120){return getSignedUrl(client,new GetObjectCommand({Bucket:config.bucket,Key:key}),{expiresIn})},
    async head(key:string):Promise<StoredObjectInfo>{
      const value=await client.send(new HeadObjectCommand({Bucket:config.bucket,Key:key}));
      return {bytes:value.ContentLength??0,contentType:value.ContentType??null};
    },
    async get(key:string){
      const value=await client.send(new GetObjectCommand({Bucket:config.bucket,Key:key}));
      if(!value.Body)throw new Error("R2_OBJECT_BODY_MISSING");
      return Buffer.from(await value.Body.transformToByteArray());
    },
    async put(key:string,body:Uint8Array,mimeType:string){await client.send(new PutObjectCommand({Bucket:config.bucket,Key:key,Body:body,ContentType:mimeType,ContentLength:body.byteLength}))},
    async remove(key:string){await client.send(new DeleteObjectCommand({Bucket:config.bucket,Key:key}))},
  };
}
export type R2Storage=ReturnType<typeof createR2Storage>;
