import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function AgendandoRelatoriosSemanaisPage() {
  return (
    <HelpArticleLayout
      title="Agendando relatórios semanais"
      category="Relatórios Automáticos"
      readTime="5 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Configure relatórios semanais automáticos para manter você e seus clientes sempre atualizados sobre o andamento dos processos. Uma vez configurado, funciona automaticamente.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Acesse as configurações de relatórios
      </h2>
      <p className="text-neutral-700 mb-4">
        No dashboard principal, navegue até:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Configurações → Relatórios Automáticos</strong></li>
        <li>Ou clique em <strong>"Configurar Relatórios"</strong> na barra lateral</li>
        <li>Ou use o botão <strong>"Novo Relatório"</strong> no painel principal</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Escolha o tipo de relatório semanal
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-2">📊 Relatório Geral</h3>
          <p className="text-green-700 mb-2">
            <strong>Para:</strong> Visão completa de todos os processos
          </p>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li>Resumo de atividades da semana</li>
            <li>Novos processos adicionados</li>
            <li>Atualizações importantes</li>
            <li>Prazos da próxima semana</li>
            <li>Métricas de produtividade</li>
          </ul>
        </div>

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">👤 Relatório por Cliente</h3>
          <p className="text-blue-700 mb-2">
            <strong>Para:</strong> Comunicação individual com clientes
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li>Apenas processos do cliente específico</li>
            <li>Linguagem adaptada para leigos</li>
            <li>Foco em resultados e próximos passos</li>
            <li>Template personalizado</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Configure o agendamento
      </h2>
      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-3">
          📅 Opções de agendamento semanal
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Dia da semana:</h4>
            <ul className="text-neutral-700 space-y-1 text-sm">
              <li>• <strong>Segunda-feira (recomendado):</strong> Planejamento da semana</li>
              <li>• <strong>Sexta-feira:</strong> Fechamento semanal</li>
              <li>• <strong>Outro dia:</strong> Conforme sua rotina</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Horário:</h4>
            <ul className="text-neutral-700 space-y-1 text-sm">
              <li>• <strong>8h00 (padrão):</strong> Início do expediente</li>
              <li>• <strong>18h00:</strong> Final do expediente</li>
              <li>• <strong>Personalizado:</strong> Qualquer horário</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Defina os destinatários
      </h2>
      <p className="text-neutral-700 mb-4">
        Configure quem receberá os relatórios semanais:
      </p>
      <div className="space-y-3 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">👨‍💼 Uso interno</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Seu email principal</li>
            <li>Outros advogados do escritório</li>
            <li>Assistentes e estagiários</li>
            <li>Sócios e coordenadores</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">👥 Clientes</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Email principal do cliente</li>
            <li>Responsável jurídico (empresas)</li>
            <li>Cópias para terceiros (família)</li>
            <li>Email secundário de backup</li>
          </ul>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Template inteligente
        </h3>
        <p className="text-neutral-700">
          O sistema automaticamente adapta o conteúdo baseado na semana. Se houver poucos updates, o relatório será mais conciso. Semanas movimentadas geram relatórios mais detalhados.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Teste antes de ativar
      </h2>
      <p className="text-neutral-700 mb-4">
        Sempre teste o relatório antes de ativar o agendamento:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Gerar amostra:</strong> Veja como ficará com dados atuais</li>
        <li><strong>Enviar teste:</strong> Mande uma cópia para seu email</li>
        <li><strong>Verificar formatação:</strong> Confira se está como esperado</li>
        <li><strong>Validar dados:</strong> Certifique-se que as informações estão corretas</li>
      </ul>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Relatórios semanais configurados!
        </h3>
        <p className="text-neutral-700">
          Seus relatórios semanais estão configurados e serão enviados automaticamente. Você pode ajustar as configurações a qualquer momento conforme suas necessidades.
        </p>
      </div>

      <p className="text-neutral-700">
        Dúvidas sobre agendamento de relatórios? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}