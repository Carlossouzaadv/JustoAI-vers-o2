import { Button } from '@/components/ui/button';
import { ICONS } from '../../../lib/icons';

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              Parcerias
            </h1>
            <p className="text-xl text-neutral-700 max-w-2xl mx-auto">
              Acreditamos no poder da colaboração para transformar a advocacia.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
            <div className="text-center mb-12">
              <h2 className="font-display font-bold text-3xl text-primary-800 mb-6">
                Vamos construir o futuro juntos?
              </h2>
              <p className="text-lg text-neutral-700 leading-relaxed max-w-3xl mx-auto">
                A JustoAI está sempre aberta a colaborações com empresas, instituições e profissionais que compartilham da nossa missão de levar mais tecnologia e eficiência para o setor jurídico no Brasil. Se você tem uma ideia, uma proposta de integração ou acredita que podemos gerar valor em conjunto para a comunidade jurídica, gostaríamos de ouvir você.
              </p>
            </div>

            <div className="text-center">
              <p className="text-neutral-700 mb-8 text-lg">
                Para iniciar uma conversa sobre parcerias, por favor, entre em contato diretamente através do e-mail abaixo.
              </p>

              <a href="mailto:parcerias@justoai.com.br">
                <Button size="lg" className="bg-accent-500 hover:bg-accent-600 text-white px-8">
                  ENVIAR E-MAIL PARA PARCERIAS
                  <span className="ml-2">{ICONS.MAIL}</span>
                </Button>
              </a>

              <div className="mt-6 text-sm text-neutral-500">
                parcerias@justoai.com.br
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}