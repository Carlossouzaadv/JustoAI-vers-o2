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
        3. Organize sua estrutura de pastas
      </h2>
      <p className="text-neutral-700 mb-4">
        Recomendamos uma organização lógica para facilitar uploads em lote:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Por cliente:</strong> Uma pasta para cada cliente</li>
        <li><strong>Por tipo de direito:</strong> Trabalhista, Civil, Criminal</li>
        <li><strong>Por status:</strong> Ativos, Arquivados, Urgentes</li>
        <li><strong>Por ano:</strong> Organização temporal dos processos</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Migração gradual recomendada
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

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Configuração de fluxos de trabalho
      </h2>
      <p className="text-neutral-700 mb-4">
        Adapte a JustoAI ao seu método de trabalho:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Categorias personalizadas:</strong> Crie categorias que fazem sentido para seu escritório</li>
        <li><strong>Templates de relatório:</strong> Configure modelos para diferentes tipos de cliente</li>
        <li><strong>Notificações:</strong> Ajuste alertas conforme sua rotina</li>
        <li><strong>Automações:</strong> Configure fluxos automáticos para casos recorrentes</li>
      </ul>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Integração com email
        </h3>
        <p className="text-neutral-700">
          Configure regras no seu email para encaminhar automaticamente petições e documentos recebidos para um email específico da JustoAI (funcionalidade em desenvolvimento).
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Backup e sincronização
      </h2>
      <p className="text-neutral-700 mb-4">
        Mantenha seus dados seguros durante a transição:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Mantenha backups locais</strong> dos arquivos originais</li>
        <li><strong>Exporte dados regularmente</strong> da JustoAI</li>
        <li><strong>Sincronize com nuvem</strong> (Google Drive, OneDrive)</li>
        <li><strong>Documente o processo</strong> de migração para referência</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        7. Treinamento da equipe
      </h2>
      <p className="text-neutral-700 mb-4">
        Garanta que toda a equipe saiba usar o novo sistema:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Sessões de treinamento:</strong> Demonstre as principais funcionalidades</li>
        <li><strong>Documentação interna:</strong> Crie guias específicos do seu escritório</li>
        <li><strong>Usuários piloto:</strong> Comece com usuários mais técnicos</li>
        <li><strong>Suporte contínuo:</strong> Mantenha canal aberto para dúvidas</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        8. Monitoramento e ajustes
      </h2>
      <p className="text-neutral-700 mb-4">
        Após a migração inicial:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Avalie a eficiência:</strong> Compare tempos antes e depois</li>
        <li><strong>Colete feedback:</strong> Ouça a equipe sobre dificuldades</li>
        <li><strong>Otimize configurações:</strong> Ajuste com base no uso real</li>
        <li><strong>Expanda gradualmente:</strong> Adicione mais funcionalidades conforme o conforto</li>
      </ul>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ⚠️ Integrações futuras
        </h3>
        <p className="text-neutral-700">
          Estamos desenvolvendo integrações diretas com sistemas jurídicos populares. Enquanto isso, a importação via Excel/CSV é a forma mais eficiente de migrar dados.
        </p>
      </div>

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