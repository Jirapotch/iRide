import type { NextConfig } from "next";
const config: NextConfig = {allowedDevOrigins:["127.0.0.1"],async redirects(){return [{source:"/learning",destination:"/knowledge",permanent:true},{source:"/learning/:path*",destination:"/knowledge/:path*",permanent:true}];}};
export default config;
