import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function ImportacaoExcelCsvPage() {
  return (
    <HelpArticleLayout
      title="Importação via Excel/CSV"
      category="Integrações"
      readTime="6 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Importe dados de processos em lote usando planilhas Excel ou arquivos CSV. Esta é a forma mais eficiente de migrar dados de sistemas existentes para a JustoAI.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Prepare sua planilha
      </h2>
      <p className="text-neutral-700 mb-4">
        Antes de fazer a importação, organize seus dados seguindo nossa estrutura recomendada:
      </p>
      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-3">
          📊 Template recomendado
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-neutral-300">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-2 text-left">numero_processo</th>
                <th className="border border-neutral-300 p-2 text-left">cliente_nome</th>
                <th className="border border-neutral-300 p-2 text-left">categoria</th>
                <th className="border border-neutral-300 p-2 text-left">status</th>
                <th className="border border-neutral-300 p-2 text-left">data_abertura</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-neutral-300 p-2">1234567-89.2024.5.02.0001</td>
                <td className="border border-neutral-300 p-2">João Silva</td>
                <td className="border border-neutral-300 p-2">Trabalhista</td>
                <td className="border border-neutral-300 p-2">Ativo</td>
                <td className="border border-neutral-300 p-2">15/03/2024</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Campos obrigatórios e opcionais
      </h2>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-3">✅ Campos obrigatórios</h3>
          <ul className="list-disc list-inside text-green-700 space-y-2 text-sm">
            <li><strong>numero_processo:</strong> Identificação única do processo</li>
            <li><strong>cliente_nome:</strong> Nome do cliente</li>
            <li><strong>categoria:</strong> Área do direito</li>
            <li><strong>status:</strong> Ativo, Arquivado, Finalizado</li>
          </ul>
        </div>
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-3">📋 Campos opcionais</h3>
          <ul className="list-disc list-inside text-blue-700 space-y-2 text-sm">
            <li><strong>data_abertura:</strong> Data de início</li>
            <li><strong>valor_causa:</strong> Valor monetário</li>
            <li><strong>advogado_responsavel:</strong> Nome do advogado</li>
            <li><strong>observacoes:</strong> Notas adicionais</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Processo de importação
      </h2>
      <div className="space-y-3 mb-6">
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Upload da planilha</h4>
            <p className="text-neutral-600 text-sm">Acesse "Importar Dados" no dashboard e faça upload do arquivo</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Mapeamento de campos</h4>
            <p className="text-neutral-600 text-sm">Confirme ou ajuste a correspondência entre colunas</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Importação final</h4>
            <p className="text-neutral-600 text-sm">Confirme e acompanhe o progresso em tempo real</p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Importação configurada!
        </h3>
        <p className="text-neutral-700">
          Com estes passos, você pode importar dados de forma eficiente e segura. Lembre-se de sempre validar os resultados e manter backups dos dados originais.
        </p>
      </div>

      <p className="text-neutral-700">
        Dificuldades com importação de dados? Nossa equipe pode ajudar em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}