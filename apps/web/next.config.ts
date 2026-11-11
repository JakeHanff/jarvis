import type { NextConfig } from "next";

// The browser only ever talks to this Next.js server. /api/* is proxied to the
// FastAPI backend, so API keys stay server-side and phones on the LAN need one URL.
const API_URL = process.env.JARVIS_API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  // Allow LAN devices (iPhone/iPad) to load dev assets.
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
