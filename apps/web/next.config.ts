import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@iride/auth",
    "@iride/config",
    "@iride/database",
    "@iride/types",
  ],
  async redirects() {
    return [
      { source: "/learning", destination: "/knowledge", permanent: true },
      {
        source: "/learning/:path*",
        destination: "/knowledge/:path*",
        permanent: true,
      },
      { source: "/community/photographers", destination: "/", permanent: true },
      {
        source: "/community/:vehicle/market",
        destination: "/",
        permanent: true,
      },
      { source: "/market", destination: "/", permanent: true },
      { source: "/photographers/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
