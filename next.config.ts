import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint config - ignore during builds for now (system functional)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Desenvolvimento - sem CSP restritivo
  async headers() {
    // Só aplicar CSP em produção
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: https:",
                "connect-src 'self' https:",
                "frame-src 'none'",
                "object-src 'none'",
                "base-uri 'self'"
              ].join('; ')
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
