import { handleGarage, handleSocialOptions } from "@/lib/social";
export const dynamic = "force-dynamic";
type Context={readonly params:Promise<{username:string}>};
export async function GET(request:Request,{params}:Context){return handleGarage(request,(await params).username)}
export function OPTIONS(request:Request){return handleSocialOptions(request)}
