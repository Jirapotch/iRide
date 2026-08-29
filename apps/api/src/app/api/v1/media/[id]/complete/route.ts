import { handleMediaComplete, handleMediaOptions } from "@/lib/media";
export const dynamic="force-dynamic";
type Context={readonly params:Promise<{id:string}>};
export async function POST(request:Request,{params}:Context){return handleMediaComplete(request,(await params).id)}
export function OPTIONS(request:Request){return handleMediaOptions(request)}
