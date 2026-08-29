import { handleCommentsCollection, handleSocialOptions } from "@/lib/social";
export const dynamic = "force-dynamic";
type Context={readonly params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){return handleCommentsCollection(request,(await params).id)}
export async function POST(request:Request,{params}:Context){return handleCommentsCollection(request,(await params).id)}
export function OPTIONS(request:Request){return handleSocialOptions(request)}
