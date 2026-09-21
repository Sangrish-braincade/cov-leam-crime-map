import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  // /api/news falls back to the bundled copy when GitHub can't be reached
  outputFileTracingIncludes: { "/api/news": ["./data/news-archive/*.json"] },
  async headers() {
    return [
      {
        // Packed crime files are named after the latest month they contain, so
        // a new month is a new URL and the old one can be cached forever.
        source: "/data/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
