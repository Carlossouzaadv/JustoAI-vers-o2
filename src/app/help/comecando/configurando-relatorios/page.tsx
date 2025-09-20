import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function ConfigurandoRelatoriosPage() {
  return (
    <HelpArticleLayout
      title="Configurando relatórios"
      category="Começando"
      readTime="6 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Os relatórios automáticos da JustoAI mantêm você e seus clientes sempre atualizados sobre o andamento dos processos. Configure uma vez e receba automaticamente.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Acesse as configurações de relatórios
      </h2>
      <p className="text-neutral-700 mb-4">
        No dashboard, vá em <strong>Configurações → Relatórios Automáticos</strong> ou clique em "Configurar Relatórios" na página de um processo específico.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Escolha a frequência de envio
      </h2>
      <p className="text-neutral-700 mb-4">
        Selecione com que frequência deseja receber os relatórios:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Semanal:</strong> Toda segunda-feira às 8h</li>
        <li><strong>Quinzenal:</strong> No 1º e 15º dia de cada mês</li>
        <li><strong>Mensal:</strong> No primeiro dia útil do mês</li>
        <li><strong>Personalizada:</strong> Defina dia e horário específicos</li>
      </ul>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Segmentação de relatórios
        </h3>
        <p className="text-neutral-700">
          Crie diferentes configurações para clientes e uso interno. Clientes recebem resumos executivos, enquanto você recebe análises detalhadas.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Configure os destinatários
      </h2>
      <p className="text-neutral-700 mb-4">
        Defina quem receberá os relatórios:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Email principal:</strong> Seu email para relatórios internos</li>
        <li><strong>Clientes:</strong> Emails dos clientes (com templates personalizados)</li>
        <li><strong>Equipe:</strong> Outros advogados do escritório</li>
        <li><strong>Cópias:</strong> Emails adicionais para backup</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Personalize o template
      </h2>
      <p className="text-neutral-700 mb-4">
        Customize a aparência e conteúdo dos relatórios:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Logo do escritório:</strong> Adicione sua marca</li>
        <li><strong>Cores personalizadas:</strong> Use as cores da sua identidade</li>
        <li><strong>Assinatura:</strong> Configure sua assinatura padrão</li>
        <li><strong>Informações de contato:</strong> Dados do escritório</li>
      </ul>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Relatórios configurados!
        </h3>
        <p className="text-neutral-700">
          Seus relatórios automáticos estão configurados e serão enviados conforme agendado. Você pode ajustar as configurações a qualquer momento.
        </p>
      </div>

      <p className="text-neutral-700">
        Dúvidas sobre configuração de relatórios? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}