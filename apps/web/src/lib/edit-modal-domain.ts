import type { CommunityCategory } from "@iride/types";
import { communityTalkHref } from "./app-navigation-domain";

export type EditableDomain="post"|"event"|"vehicle";
export function editModalUrl(domain:EditableDomain,id:string,username?:string,category:CommunityCategory="groups"){
  if(domain==="post")return `${communityTalkHref(category)}?post=${encodeURIComponent(id)}&modal=edit`;
  if(domain==="vehicle")return `/users/${encodeURIComponent(username??"")}?tab=garage&vehicle=${encodeURIComponent(id)}&modal=edit`;
  return `/maps?marker=${encodeURIComponent(id)}&modal=edit`;
}
export function legacyEditRedirect(type:string,id:string){
  if(type==="post")return editModalUrl("post",id);
  return editModalUrl("event",id);
}
