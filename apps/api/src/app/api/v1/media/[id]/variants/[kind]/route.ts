import { handleMediaOptions, handleMediaVariant } from "@/lib/media";
export const dynamic="force-dynamic";
type Context={readonly params:Promise<{id:string;kind:string}>};
export async function GET(request:Request,{params}:Context){const value=await params;return handleMediaVariant(request,value.id,value.kind)}
export function OPTIONS(request:Request){return handleMediaOptions(request)}
