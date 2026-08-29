import { handleMarketCollection, handleSocialOptions } from "@/lib/social";
export const dynamic = "force-dynamic";
export function GET(request:Request){return handleMarketCollection(request)}
export function POST(request:Request){return handleMarketCollection(request)}
export function OPTIONS(request:Request){return handleSocialOptions(request)}
