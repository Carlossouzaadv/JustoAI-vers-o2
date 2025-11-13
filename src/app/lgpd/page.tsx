import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export default function LGPDPage() {
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
              Conformidade com LGPD
            </h1>
            <p className="text-lg text-neutral-600">
              Última atualização: 16 de setembro de 2025
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">1. Compromisso com a LGPD</h2>
              <p className="text-neutral-700 mb-4">
                A JustoAI está totalmente comprometida com o cumprimento da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Implementamos processos e controles técnicos para garantir a proteção e privacidade dos dados pessoais de nossos usuários.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">2. Base Legal para Tratamento</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Execução de contrato ou diligências pré-contratuais</li>
                <li>Cumprimento de obrigação legal ou regulatória</li>
                <li>Legítimo interesse do controlador</li>
                <li>Consentimento expresso do titular dos dados</li>
                <li>Exercício regular de direitos em processo judicial</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">3. Direitos dos Titulares</h2>
              <p className="text-neutral-700 mb-4">Conforme a LGPD, você tem os seguintes direitos:</p>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Confirmação da existência de tratamento</li>
                <li>Acesso aos dados</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados</li>
                <li>Anonimização, bloqueio ou eliminação</li>
                <li>Portabilidade dos dados</li>
                <li>Eliminação dos dados tratados com consentimento</li>
                <li>Informação sobre compartilhamento</li>
                <li>Revogação do consentimento</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">4. Medidas de Segurança</h2>
              <ul className="list-disc list-inside text-neutral-700 space-y-2">
                <li>Criptografia de dados em trânsito e em repouso</li>
                <li>Controles de acesso baseados em perfis</li>
                <li>Auditoria e monitoramento contínuo</li>
                <li>Servidores localizados no Brasil</li>
                <li>Backup seguro e recuperação de desastres</li>
                <li>Compromisso com a atualização contínua sobre as melhores práticas de proteção de dados</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">5. Relatório de Impacto</h2>
              <p className="text-neutral-700 mb-4">
                Avaliamos continuamente os riscos à proteção de dados em nossas atividades para garantir que o tratamento seja sempre realizado de forma segura e para as finalidades legítimas informadas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">6. Encarregado de Dados (DPO)</h2>
              <p className="text-neutral-700 mb-4">
                Designamos um Encarregado de Proteção de Dados (Data Protection Officer) para atuar como canal de comunicação entre a empresa, os titulares dos dados e a Autoridade Nacional de Proteção de Dados (ANPD).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">7. Contato LGPD</h2>
              <p className="text-neutral-700">
                Para exercer seus direitos ou esclarecer dúvidas sobre LGPD, entre em contato conosco em{' '}
                <a href="mailto:lgpd@justoai.com.br" className="text-accent-600 hover:text-accent-700">
                  lgpd@justoai.com.br
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