import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.linkedin.com" },
      { protocol: "https", hostname: "**.naukri.com" },
      { protocol: "https", hostname: "**.indeed.com" },
    ],
  },
};

export default nextConfig;
