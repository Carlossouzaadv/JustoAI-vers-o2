import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ICONS } from '@/lib/icons';

const assets = [
  {
    name: 'Logo JustoAI (PNG)',
    description: 'Logo principal em alta resolução',
    size: '2.1 MB',
  },
  {
    name: 'Press Kit Completo',
    description: 'Logos, screenshots e informações da empresa',
    size: '15.3 MB',
  },
  {
    name: 'Foto do Fundador',
    description: 'Foto profissional do fundador da JustoAI',
    size: '3.2 MB',
  },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              Mídia Kit & Contato
            </h1>
            <p className="text-xl text-neutral-700 max-w-2xl mx-auto">
              Recursos para jornalistas, informações da empresa e contato para imprensa.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 mb-16">
            <div>
              <h2 className="font-display font-bold text-2xl text-primary-800 mb-6">
                Sobre a JustoAI
              </h2>
              <p className="text-neutral-700 text-lg leading-relaxed text-justify">
                A JustoAI é uma plataforma de automação jurídica desenvolvida por um advogado para advogados. Nossa missão é empoderar escritórios em todo o Brasil com tecnologia intuitiva, eliminando tarefas repetitivas para que os profissionais possam focar na estratégia e na entrega de resultados excepcionais para seus clientes. Acreditamos que a inteligência artificial é a chave para uma advocacia mais eficiente, transparente e justa.
              </p>
            </div>
            <Card className="p-8">
              <h3 className="font-bold text-xl text-primary-800 mb-4">Contato para Imprensa</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <span className="mr-3">{ICONS.MAIL}</span>
                  <a href="mailto:imprensa@justoai.com.br" className="text-accent-600 hover:underline">
                    imprensa@justoai.com.br
                  </a>
                </div>
                <div className="flex items-center">
                  <span className="mr-3">{ICONS.LOCATION}</span>
                  <span>Rio de Janeiro, RJ</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="mb-16">
            <h2 className="font-display font-bold text-2xl text-primary-800 mb-8 text-center">
              Recursos para Download
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {assets.map((asset, index) => (
                <Card key={index} className="p-6 text-center">
                  <div className="text-4xl mb-4">{ICONS.DOCUMENT}</div>
                  <h3 className="font-bold text-lg text-primary-800 mb-2">{asset.name}</h3>
                  <p className="text-neutral-700 mb-2">{asset.description}</p>
                  <p className="text-sm text-neutral-500 mb-4">{asset.size}</p>
                  <Button size="sm" className="w-full">
                    Download
                    <span className="ml-2">{ICONS.ARROW_DOWN}</span>
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}