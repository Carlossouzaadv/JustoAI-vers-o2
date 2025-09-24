import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint config - ignore during builds for now
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript config - ignore errors for performance testing
  typescript: {
    ignoreBuildErrors: true,
  },

  // Basic output configuration
  output: 'standalone',

  // Basic webpack config to handle Node.js modules
  webpack: (config, { isServer }) => {
    // Exclude server-only modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        querystring: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        child_process: false,
        readline: false,
        events: false,
      };
    }

    return config;
  },
};

export default nextConfig;