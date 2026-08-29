import { handleMediaOptions, handleMediaUpload } from "@/lib/media";
export const dynamic="force-dynamic";
export function POST(request:Request){return handleMediaUpload(request)}
export function OPTIONS(request:Request){return handleMediaOptions(request)}
