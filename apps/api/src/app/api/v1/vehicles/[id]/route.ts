import { handleSocialOptions, handleVehicleItem } from "@/lib/social";
export const dynamic = "force-dynamic";
type Context={readonly params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){return handleVehicleItem(request,(await params).id)}
export async function PATCH(request:Request,{params}:Context){return handleVehicleItem(request,(await params).id)}
export async function DELETE(request:Request,{params}:Context){return handleVehicleItem(request,(await params).id)}
export function OPTIONS(request:Request){return handleSocialOptions(request)}
