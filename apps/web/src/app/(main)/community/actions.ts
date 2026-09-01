"use server";
import { createCommentSchema,updateCommentSchema } from "@iride/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVerifiedWebSession } from "@/lib/auth-session";
import { createComment,deleteComment,updateComment } from "@/lib/content-api";
export async function commentAction(formData:FormData){
  const session=await getVerifiedWebSession();if(!session)redirect(`/login?next=${encodeURIComponent("/community/groups")}`);
  const intent=String(formData.get("intent")??"create"),id=String(formData.get("id")??""),postId=String(formData.get("postId")??"");
  if(intent==="delete")await deleteComment(session.accessToken,id);
  else if(intent==="update")await updateComment(session.accessToken,id,updateCommentSchema.parse({body:String(formData.get("body")??"")}));
  else await createComment(session.accessToken,postId,createCommentSchema.parse({body:String(formData.get("body")??""),parentId:String(formData.get("parentId")??"")||null}));
  revalidatePath("/community");
}
