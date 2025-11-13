import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export default function SecurityPage() {
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
              Segurança da Informação
            </h1>
            <p className="text-lg text-neutral-600">
              Última atualização: 16 de setembro de 2025
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">1. Compromisso com Segurança</h2>
              <p className="text-neutral-700 mb-4">
                A segurança dos dados é nossa prioridade máxima. Implementamos múltiplas camadas de proteção para garantir que suas informações jurídicas estejam sempre seguras e protegidas contra acessos não autorizados.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">2. Criptografia e Proteção</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>HTTPS para todas as comunicações</li>
                <li>Criptografia de dados sensíveis em banco de dados</li>
                <li>Senhas protegidas com hash seguro</li>
                <li>Conexões seguras entre serviços</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">3. Infraestrutura</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Hospedagem na AWS (Amazon Web Services) com servidores no Brasil</li>
                <li>Backup automático de dados</li>
                <li>Ambientes de desenvolvimento e produção separados</li>
                <li>Monitoramento básico de aplicação</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">4. Controle de Acesso</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Acesso protegido por login e senha</li>
                <li>Sessões com expiração automática</li>
                <li>Cada usuário acessa apenas seus próprios dados</li>
                <li>Log básico de atividades do sistema</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">5. Conformidade</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Compromisso com a LGPD (Lei Geral de Proteção de Dados)</li>
                <li>Políticas de privacidade transparentes</li>
                <li>Melhores práticas de desenvolvimento seguro</li>
                <li>Atualizações regulares de segurança</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">6. Equipe</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Equipe comprometida com boas práticas de segurança</li>
                <li>Aprendizado contínuo sobre proteção de dados</li>
                <li>Acordos de confidencialidade com toda a equipe</li>
                <li>Acesso limitado apenas ao necessário para cada função</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">7. Resposta a Incidentes</h2>
              <p className="text-neutral-700 mb-4">
                Mantemos um plano abrangente de resposta a incidentes que inclui:
              </p>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Detecção e contenção imediata de ameaças</li>
                <li>Notificação transparente aos usuários afetados</li>
                <li>Comunicação com autoridades quando necessário</li>
                <li>Análise forense e correção de vulnerabilidades</li>
                <li>Relatórios detalhados pós-incidente</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">8. Responsabilidade Compartilhada</h2>
              <p className="text-neutral-700 mb-4">
                Para manter a segurança máxima, recomendamos que você:
              </p>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Use senhas fortes e únicas</li>
                <li>Mantenha seus dispositivos atualizados</li>
                <li>Não compartilhe credenciais de acesso</li>
                <li>Faça logout ao usar computadores compartilhados</li>
                <li>Reporte atividades suspeitas imediatamente</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">9. Contato de Segurança</h2>
              <p className="text-neutral-700">
                Para reportar vulnerabilidades ou questões de segurança, entre em contato conosco em{' '}
                <a href="mailto:security@justoai.com.br" className="text-accent-600 hover:text-accent-700">
                  security@justoai.com.br
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