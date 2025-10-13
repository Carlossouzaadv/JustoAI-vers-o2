import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'JustoAI V2 - Documentação da API',
  description: 'Documentação interativa da API JustoAI V2 com Swagger/OpenAPI',
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
