/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend:4000";
    const AI      = process.env.AI_SERVICE_URL || "http://ai-service:8000";
    return [
      { source: "/api/:path*",  destination: `${BACKEND}/api/:path*` },
      { source: "/ai/:path*",   destination: `${AI}/ai/:path*` },
    ];
  },
};

module.exports = nextConfig;
