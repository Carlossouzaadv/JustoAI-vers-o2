import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Como Advogados Usam a JustoAI para Crescer",
  description: "Descubra os casos de uso da JustoAI para advogados autônomos, escritórios e departamentos jurídicos. Otimize sua prática e aumente seus honorários.",
};

export default function CasosDeUsoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}