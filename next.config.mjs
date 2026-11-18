/** @type {import('next').NextConfig} */
const SERVER_URL = process.env.API_SERVER_URL ?? "http://127.0.0.1:4000";

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  async rewrites() {
    return [
      // Browser → Next.js → Express backend (keeps the sandbox preview working
      // without exposing the API port; also avoids CORS entirely).
      { source: "/api/backend/:path*", destination: `${SERVER_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
