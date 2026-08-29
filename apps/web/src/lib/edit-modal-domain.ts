export type EditableDomain="post"|"event"|"photographer-spot"|"market"|"vehicle";
export function editModalUrl(domain:EditableDomain,id:string,username?:string){
  if(domain==="post")return `/community?room=talk&post=${encodeURIComponent(id)}&modal=edit`;
  if(domain==="market")return `/community?room=market&product=${encodeURIComponent(id)}&modal=edit`;
  if(domain==="vehicle")return `/users/${encodeURIComponent(username??"")}?tab=garage&vehicle=${encodeURIComponent(id)}&modal=edit`;
  return `/?marker=${encodeURIComponent(id)}&modal=edit`;
}
export function legacyEditRedirect(type:string,id:string){
  if(type==="post")return editModalUrl("post",id);
  if(type==="market")return editModalUrl("market",id);
  return editModalUrl(type==="photographer-spot"?"photographer-spot":"event",id);
}
