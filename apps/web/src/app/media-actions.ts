"use server";
import type { MediaPurpose, UpdateProfileInput } from "@iride/types";
import { mediaUploadRequestSchema } from "@iride/validation";
import { revalidatePath } from "next/cache";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { authorizeMediaUpload,completeMediaUpload } from "@/lib/content-api";
import { updateOwnProfile } from "@/lib/profile-api";

export async function authorizeMediaAction(input:{filename:string;mimeType:string;bytes:number;purpose:MediaPurpose}){const session=await getVerifiedWebSession();if(!session)throw new Error("AUTH_REQUIRED");return authorizeMediaUpload(session.accessToken,mediaUploadRequestSchema.parse(input))}
export async function completeMediaAction(mediaId:string){const session=await getVerifiedWebSession();if(!session)throw new Error("AUTH_REQUIRED");return completeMediaUpload(session.accessToken,mediaId)}
export async function attachProfileMediaAction(kind:"avatar"|"cover",mediaId:string){const session=await getVerifiedWebSession();if(!session)throw new Error("AUTH_REQUIRED");const input:UpdateProfileInput=kind==="avatar"?{avatarMediaId:mediaId}:{coverMediaId:mediaId};const profile=await updateOwnProfile(session.accessToken,input);if(profile.username)revalidatePath(`/users/${profile.username}`);return profile}
