import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// ================================================================
// ALLOWED HOSTS CONFIGURATION
// ================================================================
// Railway health checks come from internal domains
// We need to allow them without triggering security warnings

const allowedHosts = [
  'localhost',
  'localhost:3000',
  '127.0.0.1',
  '127.0.0.1:3000',
  // Railway internal health check domain
  'healthcheck.railway.app',
  // Production domains
  process.env.NEXT_PUBLIC_APP_DOMAIN,
  process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, ''),
].filter((host) => host && host.length > 0);

const nextConfig: NextConfig = {
  // ESLint config


  // TypeScript config
  typescript: {
    ignoreBuildErrors: false,
  },

  // Basic output configuration
  output: 'standalone',

  // Allow Railway healthcheck domain to avoid security warnings
  // This is required for Railway's internal health monitoring
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },

  // Allowed hosts for host header validation
  // Without this, Railway healthcheck generates "[SECURITY] Suspicious host header" warnings
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // Aumentado para suportar PDFs grandes
    },
  },

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

    // Suppress swagger-jsdoc critical dependency warning
    // Known issue: swagger-jsdoc uses dynamic requires for plugin loading
    // This is safe and doesn't affect functionality
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /swagger-jsdoc\/src\/utils\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },

  // Environment variables for client access to allowed hosts
  env: {
    NEXT_ALLOWED_HOSTS: allowedHosts.join(','),
  },
};

// WORKAROUND: In production builds on Vercel, disable Sentry webpack plugin
// because Next.js doesn't generate .map files for all chunks, causing 100+ false warnings
// Sentry SDK still captures errors at runtime without sourcemaps
const shouldEnableSentry = process.env.VERCEL_ENV !== 'production';

export default shouldEnableSentry
  ? withSentryConfig(nextConfig, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: 'justoai',

    project: 'justoai',

    // Only print logs for uploading source maps in CI
    silent: true,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  })
  : nextConfig;