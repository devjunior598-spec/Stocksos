import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Business profile images pass through a Server Action. Keep the request
    // below Vercel's 4.5 MB function payload cap, including multipart overhead.
    serverActions: { bodySizeLimit: 4_400_000 },
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        { key: "X-Download-Options", value: "noopen" },
        { key: "Origin-Agent-Cluster", value: "?1" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
