import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type { Tables } from "@iride/database/types";
import type {
  CommentDto,
  ContentAuthorDto,
  CreateMarketProductInput,
  CreateVehicleInput,
  MarketProductDto,
  VehicleDto,
} from "@iride/types";

import type { SocialRepository } from "./social";

interface Config { readonly url:string; readonly publishableKey:string; readonly serviceRoleKey:string }
type Admin = ReturnType<typeof createAdminDatabaseClient>;

export function createSocialRepository(config: Config): SocialRepository {
  const admin = createAdminDatabaseClient(config);
  const owner = (token: string) => createServerDatabaseClient({ url:config.url, publishableKey:config.publishableKey, accessToken:token });
  return {
    async listComments(postId, viewerId) {
      const { data, error } = await admin.from("comments").select("*").eq("post_id", postId).order("created_at");
      ensure(error);
      return commentDtos(admin, data ?? [], viewerId);
    },
    async createComment(userId, token, postId, input) {
      let parentId: string | null = null;
      let replyToUserId: string | null = null;
      if (input.parentId) {
        const parent = await findComment(admin, input.parentId);
        if (!parent || parent.post_id !== postId || parent.deleted_at) throw failure("CONTENT_NOT_FOUND", 404);
        parentId = parent.parent_id ?? parent.id;
        replyToUserId = parent.author_id;
      }
      const { data, error } = await owner(token).from("comments").insert({
        post_id:postId, author_id:userId, body:input.body, parent_id:parentId, reply_to_user_id:replyToUserId,
      }).select("*").single();
      ensureWrite(error, data);
      return (await commentDtos(admin, [data!], userId))[0]!;
    },
    async updateComment(userId, token, id, input) {
      await assertOwner(await findComment(admin, id), "author_id", userId);
      const { data, error } = await owner(token).from("comments").update({ body:input.body }).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
      ensureWrite(error, data);
      return (await commentDtos(admin, [data!], userId))[0]!;
    },
    async deleteComment(userId, token, id) {
      await assertOwner(await findComment(admin, id), "author_id", userId);
      const { data, error } = await owner(token).from("comments").update({ deleted_at:new Date().toISOString() }).eq("id", id).is("deleted_at", null).select("id").maybeSingle();
      ensureWrite(error, data);
    },
    async listGarage(username, viewerId) {
      const { data:profile, error:profileError } = await admin.from("profiles").select("id,username,display_name,visibility").eq("username", username).maybeSingle();
      ensure(profileError);
      if (!profile || (profile.visibility === "private" && profile.id !== viewerId)) return [];
      const query = admin.from("vehicles").select("*").eq("owner_id", profile.id).is("archived_at", null).order("created_at", { ascending:false });
      if (profile.id !== viewerId) query.eq("visibility", "public");
      const { data, error } = await query;
      ensure(error);
      return vehicleDtos(admin, data ?? [], viewerId);
    },
    async getVehicle(id, viewerId) {
      const row = await findVehicle(admin, id);
      if (!row || (row.owner_id !== viewerId && (row.archived_at || row.visibility !== "public"))) return null;
      return (await vehicleDtos(admin, [row], viewerId))[0] ?? null;
    },
    async createVehicle(userId, token, input) {
      await assertReadyMedia(admin, userId, input.mediaIds, "vehicle");
      const { data, error } = await owner(token).from("vehicles").insert(vehicleWrite(userId, input)).select("*").single();
      ensureWrite(error, data);
      await replaceVehicleMedia(owner(token), data!.id, input.mediaIds);
      return (await vehicleDtos(admin, [data!], userId))[0]!;
    },
    async updateVehicle(userId, token, id, input) {
      const current = await findVehicle(admin, id);
      await assertOwner(current, "owner_id", userId, "archived_at");
      if (input.mediaIds) await assertReadyMedia(admin, userId, input.mediaIds, "vehicle");
      const update = vehiclePatch(input);
      const { data, error } = await owner(token).from("vehicles").update(update).eq("id", id).is("archived_at", null).select("*").maybeSingle();
      ensureWrite(error, data);
      if (input.mediaIds) await replaceVehicleMedia(owner(token), id, input.mediaIds);
      return (await vehicleDtos(admin, [data!], userId))[0]!;
    },
    async deleteVehicle(userId, token, id) {
      await assertOwner(await findVehicle(admin, id), "owner_id", userId, "archived_at");
      const { data, error } = await owner(token).from("vehicles").update({ archived_at:new Date().toISOString() }).eq("id", id).is("archived_at", null).select("id").maybeSingle();
      ensureWrite(error, data);
    },
    async listMarketProducts(viewerId) {
      const { data, error } = await admin.from("market_products").select("*").is("deleted_at", null).order("created_at", { ascending:false }).limit(100);
      ensure(error);
      return productDtos(admin, data ?? [], viewerId);
    },
    async getMarketProduct(id, viewerId) {
      const row = await findProduct(admin, id);
      if (!row || (row.deleted_at && row.owner_id !== viewerId)) return null;
      return (await productDtos(admin, [row], viewerId))[0] ?? null;
    },
    async createMarketProduct(userId, token, input) {
      if (input.coverMediaId) await assertReadyMedia(admin, userId, [input.coverMediaId], "market");
      const { data, error } = await owner(token).from("market_products").insert(productWrite(userId, input)).select("*").single();
      ensureWrite(error, data);
      return (await productDtos(admin, [data!], userId))[0]!;
    },
    async updateMarketProduct(userId, token, id, input) {
      await assertOwner(await findProduct(admin, id), "owner_id", userId);
      if (input.coverMediaId) await assertReadyMedia(admin, userId, [input.coverMediaId], "market");
      const patch = {
        ...(input.name === undefined ? {} : { name:input.name }),
        ...(input.priceSatang === undefined ? {} : { price_satang:input.priceSatang }),
        ...(input.category === undefined ? {} : { category:input.category }),
        ...(input.vehicleKinds === undefined ? {} : { vehicle_kinds:[...input.vehicleKinds] }),
        ...(input.coverMediaId === undefined ? {} : { cover_media_id:input.coverMediaId }),
      };
      const { data, error } = await owner(token).from("market_products").update(patch).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
      ensureWrite(error, data);
      return (await productDtos(admin, [data!], userId))[0]!;
    },
    async deleteMarketProduct(userId, token, id) {
      await assertOwner(await findProduct(admin, id), "owner_id", userId);
      const { data, error } = await owner(token).from("market_products").update({ deleted_at:new Date().toISOString() }).eq("id", id).is("deleted_at", null).select("id").maybeSingle();
      ensureWrite(error, data);
    },
  };
}

async function findComment(admin:Admin,id:string){const {data,error}=await admin.from("comments").select("*").eq("id",id).maybeSingle();ensure(error);return data}
async function findVehicle(admin:Admin,id:string){const {data,error}=await admin.from("vehicles").select("*").eq("id",id).maybeSingle();ensure(error);return data}
async function findProduct(admin:Admin,id:string){const {data,error}=await admin.from("market_products").select("*").eq("id",id).maybeSingle();ensure(error);return data}

async function authors(admin:Admin, ids:readonly string[]):Promise<Map<string,ContentAuthorDto>> {
  const unique=[...new Set(ids)]; if(!unique.length)return new Map();
  const {data,error}=await admin.from("profiles").select("id,username,display_name").in("id",unique); ensure(error);
  return new Map((data??[]).filter((row)=>row.username&&row.display_name).map((row)=>[row.id,{id:row.id,username:row.username!,displayName:row.display_name!}]));
}

async function commentDtos(admin:Admin, rows:Tables<"comments">[], viewerId:string|null):Promise<CommentDto[]> {
  const people=await authors(admin,rows.flatMap((row)=>[row.author_id,...(row.reply_to_user_id?[row.reply_to_user_id]:[])]));
  return rows.flatMap((row)=>{const author=people.get(row.author_id);if(!author)return[];return[{id:row.id,postId:row.post_id,body:row.deleted_at?null:row.body,author,parentId:row.parent_id,replyTo:row.reply_to_user_id?people.get(row.reply_to_user_id)??null:null,deleted:Boolean(row.deleted_at),canEdit:!row.deleted_at&&row.author_id===viewerId,createdAt:row.created_at,updatedAt:row.updated_at}]});
}

async function vehicleDtos(admin:Admin, rows:Tables<"vehicles">[], viewerId:string|null):Promise<VehicleDto[]> {
  const people=await authors(admin,rows.map((row)=>row.owner_id));
  const ids=rows.map((row)=>row.id); const media=new Map<string,string[]>();
  if(ids.length){const {data,error}=await admin.from("vehicle_media").select("vehicle_id,media_id,position").in("vehicle_id",ids).order("position");ensure(error);for(const link of data??[])media.set(link.vehicle_id,[...(media.get(link.vehicle_id)??[]),link.media_id]);}
  return rows.flatMap((row)=>{const owner=people.get(row.owner_id);if(!owner)return[];return[{id:row.id,owner,kind:row.kind,brand:row.brand,model:row.model,year:row.year,nickname:row.nickname,description:row.description,visibility:row.visibility,mediaIds:media.get(row.id)??[],canEdit:row.owner_id===viewerId,createdAt:row.created_at,updatedAt:row.updated_at}]});
}

async function productDtos(admin:Admin, rows:Tables<"market_products">[], viewerId:string|null):Promise<MarketProductDto[]> {
  const people=await authors(admin,rows.map((row)=>row.owner_id));
  return rows.flatMap((row)=>{const owner=people.get(row.owner_id);if(!owner)return[];return[{id:row.id,owner,name:row.name,priceSatang:row.price_satang,currency:"THB" as const,category:row.category,vehicleKinds:row.vehicle_kinds,coverMediaId:row.cover_media_id,canEdit:row.owner_id===viewerId,createdAt:row.created_at,updatedAt:row.updated_at}]});
}

function vehicleWrite(ownerId:string,input:CreateVehicleInput){return{owner_id:ownerId,kind:input.kind,brand:input.brand,model:input.model,year:input.year,nickname:input.nickname,description:input.description,visibility:input.visibility}}
function vehiclePatch(input:Partial<CreateVehicleInput>){return{
  ...(input.kind===undefined?{}:{kind:input.kind}),...(input.brand===undefined?{}:{brand:input.brand}),...(input.model===undefined?{}:{model:input.model}),
  ...(input.year===undefined?{}:{year:input.year}),...(input.nickname===undefined?{}:{nickname:input.nickname}),...(input.description===undefined?{}:{description:input.description}),...(input.visibility===undefined?{}:{visibility:input.visibility}),
}}
function productWrite(ownerId:string,input:CreateMarketProductInput){return{owner_id:ownerId,name:input.name,price_satang:input.priceSatang,currency:"THB",category:input.category,vehicle_kinds:[...input.vehicleKinds],cover_media_id:input.coverMediaId}}

async function replaceVehicleMedia(client:ReturnType<typeof createServerDatabaseClient>,vehicleId:string,ids:readonly string[]){
  const removed=await client.from("vehicle_media").delete().eq("vehicle_id",vehicleId);ensure(removed.error);
  if(ids.length){const inserted=await client.from("vehicle_media").insert(ids.map((mediaId,position)=>({vehicle_id:vehicleId,media_id:mediaId,position,is_cover:position===0})));ensure(inserted.error);}
}
async function assertReadyMedia(admin:Admin,userId:string,ids:readonly string[],purpose:"vehicle"|"market"){
  if(!ids.length)return;const {data,error}=await admin.from("media").select("id,owner_id,status,purpose").in("id",[...new Set(ids)]);ensure(error);
  if((data??[]).length!==new Set(ids).size||(data??[]).some((row)=>row.owner_id!==userId||row.status!=="ready"||row.purpose!==purpose))throw failure("CONTENT_FORBIDDEN",403);
}
async function assertOwner<Row extends Record<Key,string>,Key extends string>(row:Row|null,key:Key,userId:string,deletedKey="deleted_at"){
  if(!row||row[key]!==userId||(deletedKey in row&&row[deletedKey as keyof Row]))throw failure(row?"CONTENT_FORBIDDEN":"CONTENT_NOT_FOUND",row?403:404);
}
function ensure(error:{code?:string;message?:string}|null){if(error)throw failure("CONTENT_UNAVAILABLE",503,error)}
function ensureWrite(error:{code?:string;message?:string}|null,data:unknown){if(error)throw failure(error.code==="42501"?"CONTENT_FORBIDDEN":"CONTENT_UPDATE_FAILED",error.code==="42501"?403:503,error);if(!data)throw failure("CONTENT_NOT_FOUND",404)}
function failure(code:string,status:number,cause?:unknown){return Object.assign(new Error(code,cause?{cause}:undefined),{code,status})}
