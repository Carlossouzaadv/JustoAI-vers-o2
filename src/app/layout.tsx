import type { Metadata } from 'next';
import './globals.css';
import { CookieConsentProvider } from '@/contexts/cookie-consent-context';
import { CookieBanner } from '@/components/ui/cookie-banner';
import { Providers } from './providers';
import { AuthProvider } from '@/contexts/auth-context';
import { CrispChat } from '@/components/crisp-chat';

export const dynamic = 'force-dynamic';

// Fonts are now defined locally in globals.css using @font-face
// This eliminates the network dependency on Google Fonts during build

export const metadata: Metadata = {
  title: 'JustoAI: Relatórios Jurídicos Automáticos para Advogados',
  description: 'Economize 20h por semana com nossa plataforma de automação jurídica. Crie relatórios executivos, analise processos e impressione seus clientes. Teste grátis.',
  keywords: 'advocacia, inteligência artificial, automação jurídica, relatórios automatizados, análise de processos',
  authors: [{ name: 'JustoAI' }],
  creator: 'JustoAI',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    title: 'JustoAI - Transforme sua Advocacia com IA',
    description: 'Elimine 20 horas semanais de trabalho manual com relatórios automatizados que impressionam clientes.',
    siteName: 'JustoAI',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'JustoAI - Inteligência Artificial para Advocacia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JustoAI - Transforme sua Advocacia com IA',
    description: 'Elimine 20 horas semanais de trabalho manual com relatórios automatizados.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/Justo_logo.png" />
        <link rel="apple-touch-icon" href="/Justo_logo.png" />
        <meta name="theme-color" content="#0A2A5B" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              'name': 'JustoAI',
              'applicationCategory': 'BusinessApplication',
              'operatingSystem': 'Web',
              'description': 'Plataforma de automação jurídica que cria relatórios executivos e analisa processos para advogados, economizando tempo e melhorando a comunicação com clientes.',
              'offers': {
                '@type': 'Offer',
                'price': '147.00',
                'priceCurrency': 'BRL'
              }
            })
          }}
        />
      </head>
      <body className={`font-sans antialiased bg-white text-neutral-900`}>
        {/* AuthProvider MUST be first to initialize auth state before children */}
        <AuthProvider>
          <Providers>
            <CookieConsentProvider>
              {children}
              <CookieBanner />
              <CrispChat />
            </CookieConsentProvider>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
