import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@iride/auth",
    "@iride/config",
    "@iride/database",
    "@iride/types",
    "@iride/ui",
  ],
};

export default nextConfig;
