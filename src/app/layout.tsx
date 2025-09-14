import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JustoAI - Transforme sua Advocacia com Inteligência Artificial",
  description: "Transformamos advogados em consultores estratégicos, eliminando 20 horas semanais de trabalho manual e criando relatórios que impressionam e fidelizam clientes.",
  keywords: "advocacia, inteligência artificial, automação jurídica, relatórios automatizados, análise de processos",
  authors: [{ name: "JustoAI" }],
  creator: "JustoAI",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    title: "JustoAI - Transforme sua Advocacia com IA",
    description: "Elimine 20 horas semanais de trabalho manual com relatórios automatizados que impressionam clientes.",
    siteName: "JustoAI",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "JustoAI - Inteligência Artificial para Advocacia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JustoAI - Transforme sua Advocacia com IA",
    description: "Elimine 20 horas semanais de trabalho manual com relatórios automatizados.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0A2A5B" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`font-sans antialiased bg-white text-neutral-900`}>
        {children}
      </body>
    </html>
  );
}
