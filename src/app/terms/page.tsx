import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export default function TermsPage() {
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
              Termos de Uso
            </h1>
            <p className="text-lg text-neutral-600">
              Última atualização: 17/09/2025
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            <div className="mb-8">
              <p className="text-neutral-700 mb-6">
                Bem-vindo à JustoAI. Estes Termos de Uso (&quot;Termos&quot;) regem o seu acesso e uso da plataforma de automação jurídica JustoAI (&quot;Plataforma&quot; ou &quot;Serviço&quot;), disponibilizada por [NOME DA EMPRESA], pessoa jurídica de direito privado, inscrita no CNPJ sob o nº [CNPJ], com sede em [Endereço Completo] (&quot;JustoAI&quot;).
              </p>
              <p className="text-neutral-700 mb-6">
                Ao criar uma conta, acessar ou utilizar a Plataforma, você (&quot;Usuário&quot;) declara ter lido, entendido e concordado integralmente com as condições aqui estabelecidas.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">1. Aceitação dos Termos</h2>
              <p className="text-neutral-700 mb-4">
                A aceitação destes Termos é indispensável para a utilização da Plataforma. O consentimento se dará de forma eletrônica, no momento do seu cadastro, ao clicar no botão &quot;Eu li e aceito os Termos de Uso&quot;. Ao fazê-lo, você reconhece e concorda que esta ação constitui sua assinatura eletrônica, sendo esta válida e vinculante. Se você não concordar com qualquer das disposições, não deverá utilizar o Serviço.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">2. Descrição do Serviço</h2>
              <p className="text-neutral-700 mb-4">
                A JustoAI é uma plataforma de software como serviço (SaaS) que oferece ferramentas de automação para escritórios de advocacia e advogados, incluindo, mas não se limitando a, análise de processos, geração de relatórios executivos e monitoramento automatizado. O escopo exato das funcionalidades disponíveis pode variar de acordo com o plano de assinatura contratado pelo Usuário. A JustoAI se reserva o direito de modificar, suspender ou descontinuar qualquer aspecto do Serviço a qualquer momento, mediante aviso prévio.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">3. Licença de Uso do Software</h2>
              <p className="text-neutral-700 mb-4">
                Sujeito à sua conformidade com estes Termos e ao pagamento das taxas aplicáveis, a JustoAI concede a você uma licença não exclusiva, intransferível, não sublicenciável e revogável para acessar e usar a Plataforma estritamente para seus fins profissionais internos. Este software é licenciado para uso, não vendido, e você reconhece que não adquire quaisquer direitos de propriedade sobre a Plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">4. Cadastro e Responsabilidades do Usuário</h2>
              <p className="text-neutral-700 mb-4">
                Para utilizar o Serviço, o Usuário deverá realizar um cadastro, fornecendo informações precisas e completas. O Usuário é o único responsável por:
              </p>
              <ul className="list-disc list-inside text-neutral-700 space-y-2 mb-4">
                <li>Manter a confidencialidade de suas credenciais de acesso (login e senha).</li>
                <li>Todas as atividades que ocorram em sua conta.</li>
                <li>Garantir que o uso da Plataforma esteja em conformidade com todas as leis e regulamentos aplicáveis.</li>
                <li>Não compartilhar dados sensíveis ou informações de terceiros sem a devida autorização legal.</li>
                <li>Respeitar os direitos de propriedade intelectual da JustoAI e de terceiros.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">5. Planos, Pagamentos e Cancelamento</h2>
              <p className="text-neutral-700 mb-4">
                O acesso à Plataforma é condicionado ao pagamento de uma assinatura, conforme os planos e valores detalhados em nosso site no momento da contratação.
              </p>
              <p className="text-neutral-700 mb-2">
                <strong>Faturamento:</strong> A cobrança será realizada de forma recorrente (mensal ou anual), de acordo com o ciclo escolhido.
              </p>
              <p className="text-neutral-700 mb-2">
                <strong>Inadimplência:</strong> O não pagamento da assinatura na data de vencimento poderá resultar na suspensão ou cancelamento do acesso ao Serviço, a critério da JustoAI.
              </p>
              <p className="text-neutral-700 mb-4">
                <strong>Cancelamento:</strong> O Usuário pode cancelar sua assinatura a qualquer momento através das configurações de sua conta. O cancelamento entrará em vigor ao final do período de faturamento já pago, não havendo reembolso por períodos parciais.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">6. Tratamento de Dados Pessoais (LGPD)</h2>
              <p className="text-neutral-700 mb-4">
                O tratamento de dados pessoais realizado pela JustoAI, tanto os dados do Usuário quanto os dados inseridos por este na Plataforma (dados de seus clientes, por exemplo), é regido por nossa Política de Privacidade, que é parte integrante e inseparável destes Termos. A JustoAI atua, na maioria dos casos, como Operadora dos dados inseridos pelo Usuário na Plataforma, cabendo ao Usuário o papel de Controlador desses dados, conforme as definições da Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/18).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">7. Propriedade Intelectual</h2>
              <p className="text-neutral-700 mb-4">
                Todos os direitos de propriedade intelectual relativos à Plataforma, incluindo, mas não se limitando a, software, códigos-fonte, marcas, logotipos e layouts, são de propriedade exclusiva da JustoAI. Estes Termos não concedem ao Usuário quaisquer direitos sobre a propriedade intelectual da JustoAI, exceto pela licença de uso limitada descrita na Cláusula 3. Por outro lado, todos os dados, informações e documentos inseridos pelo Usuário na Plataforma (&quot;Dados do Cliente&quot;) permanecem de propriedade exclusiva do Usuário.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">8. Limitação de Responsabilidade</h2>
              <p className="text-neutral-700 mb-4">
                A JustoAI é uma ferramenta de auxílio e otimização da prática jurídica. As análises, relatórios e demais informações geradas pela Plataforma são baseadas em algoritmos e dados fornecidos. É responsabilidade exclusiva do Usuário, como profissional qualificado, revisar, validar e aprovar todo e qualquer conteúdo gerado pela Plataforma antes de utilizá-lo para fundamentar decisões jurídicas, petições ou comunicações com clientes. A JustoAI não se responsabiliza por decisões jurídicas ou estratégicas baseadas exclusivamente nos relatórios gerados pela Plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">9. Confidencialidade</h2>
              <p className="text-neutral-700 mb-4">
                A JustoAI se compromete a manter o mais absoluto sigilo sobre todos os Dados do Cliente inseridos na Plataforma, utilizando-os unicamente para a prestação do Serviço contratado. Da mesma forma, o Usuário se compromete a não divulgar informações confidenciais sobre a tecnologia, operação e funcionalidades da Plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">10. Lei Aplicável e Foro</h2>
              <p className="text-neutral-700 mb-4">
                Estes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil. Fica eleito o foro da Comarca do Rio de Janeiro, Estado do Rio de Janeiro, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
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