import { handleSocialOptions, handleVehicleCollection } from "@/lib/social";
export const dynamic = "force-dynamic";
export function POST(request:Request){return handleVehicleCollection(request)}
export function OPTIONS(request:Request){return handleSocialOptions(request)}
