import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function IntegrandoSistemaAtualPage() {
  return (
    <HelpArticleLayout
      title="Integrando com seu sistema atual"
      category="Começando"
      readTime="7 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        A JustoAI foi projetada para se integrar facilmente ao seu fluxo de trabalho atual. Aprenda como importar dados existentes e organizar sua migração.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Avalie seu sistema atual
      </h2>
      <p className="text-neutral-700 mb-4">
        Antes de começar a integração, identifique:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Onde estão seus processos:</strong> Pastas, sistemas, nuvem</li>
        <li><strong>Formatos dos arquivos:</strong> PDF, DOC, planilhas</li>
        <li><strong>Como estão organizados:</strong> Por cliente, data, tipo</li>
        <li><strong>Informações importantes:</strong> Números de processo, prazos</li>
        <li><strong>Dados estruturados:</strong> Planilhas de controle existentes</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Importe dados via planilhas
      </h2>
      <p className="text-neutral-700 mb-4">
        A forma mais eficiente de migrar dados estruturados:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Organize uma planilha Excel/CSV</strong> com suas informações</li>
        <li><strong>Colunas sugeridas:</strong> Número do processo, Cliente, Categoria, Status, Data</li>
        <li><strong>Use o template</strong> disponível na seção "Importar Dados"</li>
        <li><strong>Valide os dados</strong> antes da importação</li>
      </ul>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          📊 Template de importação
        </h3>
        <p className="text-neutral-700 mb-3">
          Baixe nosso template Excel pré-formatado para facilitar a importação:
        </p>
        <div className="bg-white p-3 rounded border text-sm font-mono">
          Número do Processo | Cliente | Categoria | Status | Data Abertura | Observações
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Migração gradual recomendada
      </h2>
      <p className="text-neutral-700 mb-4">
        Para uma transição suave, siga esta sequência:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Semana 1:</strong> Processos urgentes e ativos</li>
        <li><strong>Semana 2:</strong> Casos importantes de clientes principais</li>
        <li><strong>Semana 3:</strong> Processos de rotina e acompanhamento</li>
        <li><strong>Semana 4:</strong> Arquivo histórico conforme necessário</li>
      </ul>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Integração bem-sucedida!
        </h3>
        <p className="text-neutral-700">
          Com estes passos, você terá uma migração organizada e eficiente. Lembre-se: a migração não precisa ser feita toda de uma vez.
        </p>
      </div>

      <p className="text-neutral-700">
        Precisa de ajuda com a integração? Nossa equipe pode auxiliar em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}