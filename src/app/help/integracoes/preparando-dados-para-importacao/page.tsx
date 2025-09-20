import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function PreparandoDadosImportacaoPage() {
  return (
    <HelpArticleLayout
      title="Preparando dados para importação"
      category="Integrações"
      readTime="8 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Uma preparação adequada dos dados é fundamental para uma importação bem-sucedida. Este guia abrangente ajuda você a organizar, limpar e estruturar seus dados antes de importá-los para a JustoAI.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Auditoria inicial dos dados
      </h2>
      <p className="text-neutral-700 mb-4">
        Antes de começar, faça uma análise completa dos dados existentes:
      </p>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-3">📊 Inventário de dados</h3>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li><strong>Fontes:</strong> Onde estão seus dados atualmente?</li>
            <li><strong>Formatos:</strong> Excel, PDF, sistema jurídico, papel?</li>
            <li><strong>Volume:</strong> Quantos processos e documentos?</li>
            <li><strong>Qualidade:</strong> Dados completos ou com lacunas?</li>
            <li><strong>Redundância:</strong> Informações duplicadas?</li>
            <li><strong>Histórico:</strong> Período que os dados cobrem</li>
          </ul>
        </div>
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-3">🎯 Definição de objetivos</h3>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li><strong>Prioridades:</strong> Quais dados são mais importantes?</li>
            <li><strong>Urgência:</strong> O que precisa ser migrado primeiro?</li>
            <li><strong>Precisão:</strong> Nível de exatidão necessário</li>
            <li><strong>Completude:</strong> Dados mínimos vs. ideais</li>
            <li><strong>Uso futuro:</strong> Como os dados serão utilizados?</li>
            <li><strong>Recursos:</strong> Tempo e pessoal disponível</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Estruturação e padronização
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">📋 Campos essenciais</h3>
          <p className="text-neutral-700 mb-3">Organize seus dados seguindo esta estrutura mínima:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-neutral-300">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-neutral-300 p-2 text-left">Campo</th>
                  <th className="border border-neutral-300 p-2 text-left">Obrigatório</th>
                  <th className="border border-neutral-300 p-2 text-left">Formato</th>
                  <th className="border border-neutral-300 p-2 text-left">Exemplo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-300 p-2">numero_processo</td>
                  <td className="border border-neutral-300 p-2 text-green-600">✓ Sim</td>
                  <td className="border border-neutral-300 p-2">Texto único</td>
                  <td className="border border-neutral-300 p-2">1234567-89.2024.5.02.0001</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">cliente_nome</td>
                  <td className="border border-neutral-300 p-2 text-green-600">✓ Sim</td>
                  <td className="border border-neutral-300 p-2">Texto</td>
                  <td className="border border-neutral-300 p-2">João Silva</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">categoria</td>
                  <td className="border border-neutral-300 p-2 text-green-600">✓ Sim</td>
                  <td className="border border-neutral-300 p-2">Lista pré-definida</td>
                  <td className="border border-neutral-300 p-2">Trabalhista</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">status</td>
                  <td className="border border-neutral-300 p-2 text-green-600">✓ Sim</td>
                  <td className="border border-neutral-300 p-2">Lista pré-definida</td>
                  <td className="border border-neutral-300 p-2">Ativo</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">data_abertura</td>
                  <td className="border border-neutral-300 p-2 text-blue-600">Opcional</td>
                  <td className="border border-neutral-300 p-2">DD/MM/AAAA</td>
                  <td className="border border-neutral-300 p-2">15/03/2024</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Limpeza de dados
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-yellow-800 mb-3">🧹 Problemas comuns a corrigir</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-yellow-800 mb-2">Dados inconsistentes:</h4>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                <li><strong>Nomes variados:</strong> "João Silva" vs "JOAO SILVA"</li>
                <li><strong>Categorias diferentes:</strong> "Trabalhista" vs "Trabalho"</li>
                <li><strong>Datas em formatos diferentes:</strong> 15/03/24 vs 2024-03-15</li>
                <li><strong>Números com formatação:</strong> "R$ 25.000,00" vs "25000"</li>
                <li><strong>Campos em branco:</strong> Vazios vs NULL vs "N/A"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-yellow-800 mb-2">Como corrigir:</h4>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                <li>Use MAIÚSCULA() ou minúscula() para padronizar</li>
                <li>Crie uma tabela de conversão de categorias</li>
                <li>Configure formato de data único</li>
                <li>Remova símbolos e formatação de números</li>
                <li>Padronize campos vazios (deixe em branco)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Teste piloto
      </h2>
      <p className="text-neutral-700 mb-4">
        Sempre execute um teste com uma pequena amostra antes da importação completa:
      </p>
      <div className="space-y-3 mb-6">
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Selecione amostra representativa</h4>
            <p className="text-neutral-600 text-sm">10-20 registros que representem a variedade dos seus dados</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Execute importação teste</h4>
            <p className="text-neutral-600 text-sm">Verifique se todos os campos são mapeados corretamente</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Valide resultados</h4>
            <p className="text-neutral-600 text-sm">Compare dados importados com originais, ajuste se necessário</p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Dados prontos para importação!
        </h3>
        <p className="text-neutral-700">
          Seguindo estes passos, seus dados estarão bem preparados para uma importação suave e bem-sucedida. Lembre-se: tempo investido na preparação economiza horas de correção posterior.
        </p>
      </div>

      <p className="text-neutral-700">
        Precisa de ajuda com preparação de dados específicos? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}