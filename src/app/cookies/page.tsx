import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8 lg:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <Link href="/" className="inline-flex items-center space-x-3 mb-8">
              <div className="w-10 h-10">
                <Image src="/logo+nome.png" alt="JustoAI" width={120} height={40} className="w-full h-full object-contain" />
              </div>
              <span className="font-display font-bold text-2xl text-primary-800">JustoAI</span>
            </Link>
            <h1 className="font-display font-bold text-4xl text-primary-800 mb-4">
              Política de Cookies
            </h1>
            <p className="text-lg text-neutral-600">
              Última atualização: 16 de setembro de 2025
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">1. O que são Cookies</h2>
              <p className="text-neutral-700 mb-4">
                Cookies são pequenos arquivos de texto armazenados em seu dispositivo quando você visita nosso site. Eles nos ajudam a melhorar sua experiência, lembrando suas preferências e fornecendo funcionalidades personalizadas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">2. Tipos de Cookies que Utilizamos</h2>

              <div className="mb-6">
                <h3 className="font-display font-semibold text-xl text-primary-700 mb-3">Cookies Essenciais</h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-2">
                  <li>Autenticação e segurança da sessão</li>
                  <li>Prevenção contra fraudes</li>
                  <li>Funcionalidades básicas da plataforma</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="font-display font-semibold text-xl text-primary-700 mb-3">Cookies de Funcionalidade</h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-2">
                  <li>Lembrar suas preferências de idioma</li>
                  <li>Manter configurações de interface</li>
                  <li>Personalizar conteúdo</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="font-display font-semibold text-xl text-primary-700 mb-3">Cookies Analíticos</h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-2">
                  <li>Análise de uso da plataforma</li>
                  <li>Métricas de performance</li>
                  <li>Identificação de melhorias</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">3. Cookies de Terceiros</h2>
              <p className="text-neutral-700 mb-4">
                Utilizamos serviços de terceiros confiáveis que podem definir cookies em nosso site:
              </p>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Google Analytics para análise de tráfego</li>
                <li>Serviços de autenticação</li>
                <li>Provedores de infraestrutura em nuvem</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">4. Gerenciamento de Cookies</h2>
              <p className="text-neutral-700 mb-4">
                Você pode controlar e gerenciar cookies através das configurações do seu navegador:
              </p>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Bloquear todos os cookies</li>
                <li>Aceitar apenas cookies específicos</li>
                <li>Excluir cookies existentes</li>
                <li>Receber alertas antes de aceitar cookies</li>
              </ul>
              <p className="text-neutral-700 mt-4">
                <strong>Importante:</strong> Desabilitar cookies essenciais pode afetar o funcionamento da plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">5. Tempo de Armazenamento</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li><strong>Cookies de Sessão:</strong> Removidos quando você fecha o navegador</li>
                <li><strong>Cookies Persistentes:</strong> Mantidos por períodos específicos (até 12 meses)</li>
                <li><strong>Cookies de Segurança:</strong> Duração limitada para proteção</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">6. Atualizações desta Política</h2>
              <p className="text-neutral-700 mb-4">
                Esta política de cookies pode ser atualizada periodicamente. Recomendamos que você revise esta página regularmente para se manter informado sobre como utilizamos cookies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">7. Contato</h2>
              <p className="text-neutral-700">
                Para dúvidas sobre nossa política de cookies, entre em contato conosco em{' '}
                <a href="mailto:cookies@justoai.com.br" className="text-accent-600 hover:text-accent-700">
                  cookies@justoai.com.br
                </a>
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 pt-8 border-t border-neutral-200">
            <Link href="/">
              <Button className="bg-primary-800 hover:bg-primary-700 text-white">
                {ICONS.ARROW_RIGHT} Voltar ao Início
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}