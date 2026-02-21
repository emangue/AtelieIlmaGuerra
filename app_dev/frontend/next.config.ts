import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { buildActivity: false },
  async rewrites() {
    // Em dev, proxy /api e /uploads para o backend (quando NEXT_PUBLIC_BACKEND_URL está vazio)
    return [
      { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
      { source: "/uploads/:path*", destination: "http://localhost:8000/uploads/:path*" },
    ];
  },
};

export default nextConfig;
