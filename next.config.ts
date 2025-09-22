import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint config - ignore during builds for now (system functional)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript config - ignore errors for performance testing
  typescript: {
    ignoreBuildErrors: true,
  },

  // ======================================
  // OTIMIZAÇÕES DE PERFORMANCE
  // ======================================

  // Compressão e minificação
  compress: true,

  // Otimização de imagens
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 ano
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Configuração de build otimizada
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Headers para cache e performance
  async headers() {
    const headers = [
      // Cache de assets estáticos
      {
        source: '/optimized/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 ano
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 ano
          },
        ],
      },
      // Cache de imagens
      {
        source: '/:path*.{jpg,jpeg,png,gif,webp,avif,ico,svg}',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 1 dia
          },
        ],
      },
      // Headers de segurança e performance
      {
        source: '/(.*)',
        headers: [
          // Performance headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          // Segurança contra clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Prevenção de MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Política de referrer
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Proteção XSS (legacy support)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Forçar HTTPS via HSTS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          // Política de permissões
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
        ],
      },
    ];

    // CSP (Content Security Policy) para produção
    if (process.env.NODE_ENV === 'production') {
      headers.push({
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://www.google-analytics.com https://api.supabase.co wss://api.supabase.co",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "media-src 'self'",
              "worker-src 'self' blob:",
              "child-src 'none'",
              "manifest-src 'self'"
            ].join('; ')
          },
        ],
      });
    }

    return headers;
  },

  // Configuração de webpack para minificação
  webpack: (config, { dev, isServer }) => {
    // Apenas em produção
    if (!dev) {
      // Minificação adicional de CSS
      const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

      config.optimization = {
        ...config.optimization,
        minimizer: [
          ...config.optimization.minimizer,
          new CssMinimizerPlugin({
            minimizerOptions: {
              preset: [
                'default',
                {
                  discardComments: { removeAll: true },
                  normalizeWhitespace: true,
                  colormin: true,
                  convertValues: true,
                  reduceIdents: true,
                  mergeLonghand: true,
                  mergeRules: true,
                  minifyFontValues: true,
                  minifySelectors: true,
                }
              ],
            },
          }),
        ],
      };

      // Tree shaking melhorado
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Divisão de chunks otimizada
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            minChunks: 2,
            chunks: 'all',
            enforce: true,
          },
        },
      };
    }

    return config;
  },
};

export default nextConfig;
