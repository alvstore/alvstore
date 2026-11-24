/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material", "lucide-react", "date-fns"],
  },
  // Allow the sandbox live-preview host to load dev assets/HMR
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
};

export default nextConfig;
