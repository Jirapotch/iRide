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
  async redirects() {
    return [
      { source: "/community/photographers", destination: "/", permanent: true },
      { source: "/community/:vehicle/market", destination: "/", permanent: true },
      { source: "/market", destination: "/", permanent: true },
      { source: "/photographers/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
