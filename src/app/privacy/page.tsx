import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ICONS } from '../../../lib/icons';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8 lg:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <Link href="/" className="inline-flex items-center space-x-3 mb-8">
              <div className="w-10 h-10">
                <img src="/logo+nome.png" alt="JustoAI" className="w-full h-full object-contain" />
              </div>
              <span className="font-display font-bold text-2xl text-primary-800">JustoAI</span>
            </Link>
            <h1 className="font-display font-bold text-4xl text-primary-800 mb-4">
              Política de Privacidade
            </h1>
            <p className="text-lg text-neutral-600">
              Última atualização: 17/09/2025
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            <div className="mb-8">
              <p className="text-neutral-700 mb-6">
                A sua privacidade e a segurança dos seus dados são prioridades para a JustoAI ("nós"). Esta Política de Privacidade ("Política") descreve como coletamos, usamos, armazenamos, compartilhamos e protegemos seus Dados Pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/18) e o Marco Civil da Internet (Lei nº 12.965/14).
              </p>
              <p className="text-neutral-700 mb-6">
                Esta Política é um complemento aos nossos Termos de Uso. Ao aceitar os Termos, você também concorda com esta Política.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">1. Definições Importantes (LGPD)</h2>
              <p className="text-neutral-700 mb-2">
                <strong>Dado Pessoal:</strong> Qualquer informação relacionada a uma pessoa natural identificada ou identificável.
              </p>
              <p className="text-neutral-700 mb-2">
                <strong>Controlador:</strong> A quem competem as decisões referentes ao tratamento de dados pessoais.
              </p>
              <p className="text-neutral-700 mb-2">
                <strong>Operador:</strong> Quem realiza o tratamento de dados pessoais em nome do Controlador.
              </p>
              <p className="text-neutral-700 mb-4">
                <strong>Tratamento:</strong> Toda operação realizada com dados pessoais (coleta, uso, acesso, armazenamento, etc.).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">2. Dados que Coletamos e Finalidades</h2>
              <p className="text-neutral-700 mb-4">
                Coletamos diferentes tipos de dados para finalidades específicas:
              </p>

              <div className="mb-4">
                <p className="text-neutral-700 mb-2">
                  <strong>Dados de Cadastro:</strong> Nome, e-mail, CPF/CNPJ, telefone, endereço.
                </p>
                <p className="text-neutral-700 mb-4">
                  <strong>Finalidade:</strong> Identificar o Usuário, criar e gerenciar sua conta, processar pagamentos, enviar comunicações administrativas e cumprir obrigações legais e contratuais.
                </p>
              </div>

              <div className="mb-4">
                <p className="text-neutral-700 mb-2">
                  <strong>Dados de Navegação:</strong> Endereço IP, tipo de navegador, páginas visitadas, tempo de permanência.
                </p>
                <p className="text-neutral-700 mb-4">
                  <strong>Finalidade:</strong> Monitorar o desempenho da Plataforma, prevenir fraudes, melhorar a experiência do usuário e realizar análises estatísticas.
                </p>
              </div>

              <div className="mb-4">
                <p className="text-neutral-700 mb-2">
                  <strong>Dados Inseridos na Plataforma ("Dados do Cliente"):</strong> Informações de processos, documentos, dados de clientes do Usuário e outras informações inseridas para utilização das funcionalidades.
                </p>
                <p className="text-neutral-700 mb-4">
                  <strong>Finalidade:</strong> Prestar o serviço contratado. Nestes casos, a JustoAI atua como Operadora, tratando os dados em nome e sob as instruções do Usuário, que é o Controlador.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">3. Compartilhamento de Dados Pessoais</h2>
              <p className="text-neutral-700 mb-4">
                A JustoAI não vende seus dados pessoais. Podemos compartilhar seus dados com terceiros nas seguintes hipóteses:
              </p>
              <p className="text-neutral-700 mb-2">
                <strong>Provedores de Serviço:</strong> Com empresas que nos auxiliam a operar o serviço, como provedores de infraestrutura em nuvem (hospedagem), processadores de pagamento e ferramentas de análise. Exigimos que todos os nossos parceiros cumpram com as mesmas normas de segurança e privacidade que nós.
              </p>
              <p className="text-neutral-700 mb-2">
                <strong>Obrigação Legal ou Ordem Judicial:</strong> Para cumprir com a legislação vigente ou em resposta a uma ordem judicial.
              </p>
              <p className="text-neutral-700 mb-4">
                <strong>Proteção de Direitos:</strong> Para proteger os direitos, a propriedade ou a segurança da JustoAI, de nossos usuários ou do público em geral.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">4. Direitos do Titular dos Dados</h2>
              <p className="text-neutral-700 mb-4">
                A LGPD garante a você, como titular dos dados, uma série de direitos, incluindo:
              </p>
              <ul className="list-disc list-inside text-neutral-700 space-y-2 mb-4">
                <li>Confirmação da existência de tratamento.</li>
                <li>Acesso aos seus dados.</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários.</li>
                <li>Portabilidade dos dados a outro fornecedor.</li>
                <li>Eliminação dos dados pessoais tratados com o seu consentimento.</li>
                <li>Informação sobre com quem compartilhamos seus dados.</li>
              </ul>
              <p className="text-neutral-700 mb-4">
                Para exercer seus direitos, entre em contato conosco pelo e-mail: [EMAIL_DPO].
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">5. Segurança dos Dados</h2>
              <p className="text-neutral-700 mb-4">
                Adotamos medidas de segurança técnicas e administrativas para proteger seus dados pessoais contra acessos não autorizados e situações de destruição, perda ou alteração. Utilizamos criptografia, controle de acesso restrito e outras práticas de mercado para garantir a segurança da informação.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">6. Armazenamento e Exclusão de Dados</h2>
              <p className="text-neutral-700 mb-4">
                Armazenamos seus dados pessoais pelo tempo necessário para cumprir as finalidades para as quais foram coletados, incluindo para fins de cumprimento de obrigações legais ou regulatórias. Ao término da sua relação conosco, você pode solicitar a exclusão definitiva dos seus dados, que será realizada, ressalvadas as hipóteses de guarda obrigatória previstas em lei.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display font-semibold text-2xl text-primary-800 mb-4">7. Contato</h2>
              <p className="text-neutral-700 mb-4">
                Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos seus dados, entre em contato com nosso Encarregado pela Proteção de Dados (DPO):
              </p>
              <p className="text-neutral-700 mb-2">
                <strong>Nome do Encarregado (DPO):</strong> [NOME_DPO]
              </p>
              <p className="text-neutral-700">
                <strong>E-mail:</strong> <a href="mailto:[EMAIL_DPO]" className="text-accent-600 hover:text-accent-700">[EMAIL_DPO]</a>
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