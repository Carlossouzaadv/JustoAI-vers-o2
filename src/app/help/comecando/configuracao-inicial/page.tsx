import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function ConfiguracaoInicialPage() {
  return (
    <HelpArticleLayout
      title="Configuração inicial"
      category="Começando"
      readTime="5 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Após criar sua conta, é importante configurar adequadamente seu perfil e preferências para otimizar sua experiência com a JustoAI.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Complete seu perfil
      </h2>
      <p className="text-neutral-700 mb-4">
        Acesse <strong>Configurações → Perfil</strong> e complete as informações:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Foto de perfil:</strong> Adicione uma foto profissional</li>
        <li><strong>Área de atuação:</strong> Informe suas especialidades jurídicas</li>
        <li><strong>Endereço do escritório:</strong> Para relatórios e documentos</li>
        <li><strong>Preferências de notificação:</strong> Como deseja receber alertas</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Configure suas preferências de análise
      </h2>
      <p className="text-neutral-700 mb-4">
        A JustoAI oferece diferentes tipos de análise para seus processos:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Análise Essencial:</strong> Resumo básico e pontos principais (mais rápida)</li>
        <li><strong>Análise Estratégica:</strong> Avaliação jurídica e recomendações (balanceada)</li>
        <li><strong>Análise Completa:</strong> Relatório detalhado com estratégias (mais completa)</li>
      </ul>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          📋 Dica: Escolha do tipo de análise
        </h3>
        <p className="text-neutral-700">
          Para processos de rotina, use a Análise Essencial. Para casos importantes ou complexos, opte pela Análise Completa. A Estratégica é ideal para a maioria dos casos.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Defina suas categorias de processos
      </h2>
      <p className="text-neutral-700 mb-4">
        Organize seus processos criando categorias personalizadas:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Direito do Trabalho</li>
        <li>Direito Civil</li>
        <li>Direito Tributário</li>
        <li>Direito Criminal</li>
        <li>Ou qualquer categoria específica do seu escritório</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Configure notificações inteligentes
      </h2>
      <p className="text-neutral-700 mb-4">
        Em <strong>Configurações → Notificações</strong>, você pode definir:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Alertas de prazo:</strong> Receba lembretes antes dos vencimentos</li>
        <li><strong>Análises concluídas:</strong> Seja notificado quando as análises ficarem prontas</li>
        <li><strong>Relatórios enviados:</strong> Confirmação de entrega de relatórios automáticos</li>
        <li><strong>Atualizações de processos:</strong> Mudanças importantes detectadas</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Integre seu email
      </h2>
      <p className="text-neutral-700 mb-4">
        Para receber relatórios automáticos por email, configure:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Email principal para recebimento de relatórios</li>
        <li>Emails secundários para cópias (se necessário)</li>
        <li>Modelo de assinatura para relatórios enviados a clientes</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Teste as funcionalidades
      </h2>
      <p className="text-neutral-700 mb-4">
        Com tudo configurado, faça um teste das principais funcionalidades:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Faça upload de um processo teste</li>
        <li>Execute uma análise</li>
        <li>Configure um relatório automático</li>
        <li>Teste o sistema de notificações</li>
      </ul>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Configuração concluída!
        </h3>
        <p className="text-neutral-700">
          Com essas configurações básicas, você já pode começar a usar a JustoAI de forma eficiente. Todas as configurações podem ser ajustadas posteriormente conforme suas necessidades.
        </p>
      </div>

      <p className="text-neutral-700">
        Dúvidas sobre alguma configuração? Entre em contato com nosso suporte em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}