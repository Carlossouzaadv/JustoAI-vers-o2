import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers para garantir UTF-8
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/html; charset=utf-8',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
