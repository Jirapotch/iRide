import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@iride/auth",
    "@iride/config",
    "@iride/database",
    "@iride/domain",
    "@iride/storage",
    "@iride/types",
    "@iride/validation",
  ],
};

export default nextConfig;
