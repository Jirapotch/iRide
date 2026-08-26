import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: { bodySizeLimit: "9mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      ...(process.env.CLOUDFLARE_ACCOUNT_ID
        ? [{ protocol: "https" as const, hostname: `${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com` }]
        : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
