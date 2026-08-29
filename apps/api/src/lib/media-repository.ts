import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type { Json } from "@iride/database/types";

import type { MediaRepository } from "./media";

interface Config{readonly url:string;readonly publishableKey:string;readonly serviceRoleKey:string}
export function createMediaRepository(config:Config):MediaRepository{
  const admin=createAdminDatabaseClient(config);const owner=(token:string)=>createServerDatabaseClient({url:config.url,publishableKey:config.publishableKey,accessToken:token});
  return{
    async createUpload(input,token){const {error}=await owner(token).from("media").insert({id:input.id,owner_id:input.ownerId,purpose:input.purpose,status:"uploading",original_object_key:input.objectKey,filename:input.filename,mime_type:input.mimeType,bytes:input.bytes});ensure(error)},
    async findOwnedUpload(userId,id){const {data,error}=await admin.from("media").select("*").eq("id",id).eq("owner_id",userId).is("deleted_at",null).maybeSingle();ensure(error);return data?{id:data.id,ownerId:data.owner_id,purpose:data.purpose,status:data.status,objectKey:data.original_object_key,mimeType:data.mime_type,bytes:data.bytes}:null},
    async markProcessingAndEnqueue(userId,id,message){const {error}=await admin.rpc("complete_media_upload",{target_media_id:id,expected_owner_id:userId,message:message as unknown as Json});ensure(error)},
    async findDeliverableVariant(id,kind,viewerId){
      const {data:media,error}=await admin.from("media").select("id,owner_id,status,deleted_at").eq("id",id).maybeSingle();ensure(error);if(!media||media.status!=="ready"||media.deleted_at)return null;
      if(media.owner_id!==viewerId&&!await publiclyReferenced(admin,id))return null;
      const {data,error:variantError}=await admin.from("media_variants").select("object_key").eq("media_id",id).eq("kind",kind).maybeSingle();ensure(variantError);return data?{objectKey:data.object_key}:null;
    },
  };
}
async function publiclyReferenced(admin:ReturnType<typeof createAdminDatabaseClient>,id:string){
  const [profiles,products,links]=await Promise.all([
    admin.from("profiles").select("id").or(`avatar_media_id.eq.${id},cover_media_id.eq.${id}`).in("visibility",["public","followers"]).limit(1),
    admin.from("market_products").select("id").eq("cover_media_id",id).is("deleted_at",null).limit(1),
    admin.from("vehicle_media").select("vehicle_id").eq("media_id",id).limit(20),
  ]);ensure(profiles.error);ensure(products.error);ensure(links.error);if(profiles.data?.length||products.data?.length)return true;
  const vehicleIds=(links.data??[]).map((row)=>row.vehicle_id);if(!vehicleIds.length)return false;
  const {data,error}=await admin.from("vehicles").select("id").in("id",vehicleIds).eq("visibility","public").is("archived_at",null).limit(1);ensure(error);return Boolean(data?.length);
}
function ensure(error:{message?:string}|null){if(error)throw Object.assign(new Error("MEDIA_UNAVAILABLE",{cause:error}),{code:"MEDIA_UNAVAILABLE",status:503})}
