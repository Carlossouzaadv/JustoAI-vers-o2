/* eslint-disable react/no-unescaped-entities */
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
                <tr>
                  <td className="border border-neutral-300 p-2">valor_causa</td>
                  <td className="border border-neutral-300 p-2 text-blue-600">Opcional</td>
                  <td className="border border-neutral-300 p-2">Número decimal</td>
                  <td className="border border-neutral-300 p-2">25000.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">🔧 Padronização de valores</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Categorias padronizadas:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>Trabalhista</li>
                <li>Civil</li>
                <li>Criminal</li>
                <li>Tributário</li>
                <li>Previdenciário</li>
                <li>Empresarial</li>
                <li>Família</li>
                <li>Consumidor</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Status padronizados:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>Ativo</li>
                <li>Arquivado</li>
                <li>Finalizado</li>
                <li>Suspenso</li>
                <li>Em negociação</li>
                <li>Aguardando documentos</li>
                <li>Em análise</li>
                <li>Urgente</li>
              </ul>
            </div>
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

        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-red-800 mb-3">🗑️ Dados a remover</h3>
          <ul className="list-disc list-inside text-red-700 space-y-2 text-sm">
            <li><strong>Linhas totalmente vazias:</strong> Podem causar erros na importação</li>
            <li><strong>Dados de teste:</strong> "Teste 123", "xxxxx", etc.</li>
            <li><strong>Duplicatas exatas:</strong> Registros completamente idênticos</li>
            <li><strong>Caracteres especiais problemáticos:</strong> ©, ®, emojis</li>
            <li><strong>Dados sensíveis desnecessários:</strong> CPF, senhas</li>
            <li><strong>Formatação condicional complexa:</strong> Cores, bordas</li>
          </ul>
        </div>
      </div>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Ferramentas para limpeza
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Excel/Google Sheets:</h4>
            <ul className="text-neutral-700 space-y-1">
              <li>• Localizar e substituir (Ctrl+H)</li>
              <li>• Remover duplicatas</li>
              <li>• Filtros para identificar problemas</li>
              <li>• Formatação condicional para validar</li>
              <li>• Função LIMPAR() para caracteres especiais</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Ferramentas especializadas:</h4>
            <ul className="text-neutral-700 space-y-1">
              <li>• OpenRefine (Google) - gratuito</li>
              <li>• Trifacta (Tableau) - pago</li>
              <li>• Power Query (Excel) - integrado</li>
              <li>• Python/R - para casos complexos</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Validação e controle de qualidade
      </h2>
      <div className="space-y-3 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">✅ Checklist de validação</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Estrutura dos dados:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>□ Cabeçalhos na primeira linha</li>
                <li>□ Nomes de colunas padronizados</li>
                <li>□ Sem colunas completamente vazias</li>
                <li>□ Sem linhas vazias no meio dos dados</li>
                <li>□ Formato consistente em cada coluna</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Conteúdo dos dados:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>□ Todos os campos obrigatórios preenchidos</li>
                <li>□ Datas em formato DD/MM/AAAA</li>
                <li>□ Números sem formatação especial</li>
                <li>□ Categorias dentro da lista aceita</li>
                <li>□ Sem caracteres especiais problemáticos</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">📊 Relatório de qualidade</h3>
          <p className="text-neutral-700 mb-3">Gere estatísticas dos seus dados antes da importação:</p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Total de registros:</strong> Quantos processos serão importados</li>
            <li><strong>Campos preenchidos:</strong> % de completude por coluna</li>
            <li><strong>Valores únicos:</strong> Quantos clientes, categorias diferentes</li>
            <li><strong>Período coberto:</strong> Datas mais antigas e mais recentes</li>
            <li><strong>Duplicatas potenciais:</strong> Registros que podem ser duplicados</li>
            <li><strong>Valores atípicos:</strong> Dados que fogem do padrão</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Segmentação estratégica
      </h2>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-2">🚀 Lote 1: Prioritários</h3>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li>Processos ativos e urgentes</li>
            <li>Clientes principais</li>
            <li>Dados mais completos</li>
            <li>50-200 registros</li>
            <li>Teste inicial do sistema</li>
          </ul>
        </div>
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">📋 Lote 2: Regulares</h3>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li>Processos ativos normais</li>
            <li>Todos os clientes</li>
            <li>Dados padronizados</li>
            <li>200-1000 registros</li>
            <li>Operação principal</li>
          </ul>
        </div>
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-purple-800 mb-2">📦 Lote 3: Arquivo</h3>
          <ul className="list-disc list-inside text-purple-600 space-y-1 text-sm">
            <li>Processos finalizados</li>
            <li>Dados históricos</li>
            <li>Informações de referência</li>
            <li>Volume variável</li>
            <li>Consulta posterior</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Mapeamento de campos
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">🗺️ De sistema antigo para JustoAI</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-neutral-300">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-neutral-300 p-2 text-left">Sistema Antigo</th>
                  <th className="border border-neutral-300 p-2 text-left">JustoAI</th>
                  <th className="border border-neutral-300 p-2 text-left">Transformação necessária</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-300 p-2">Nº do Processo</td>
                  <td className="border border-neutral-300 p-2">numero_processo</td>
                  <td className="border border-neutral-300 p-2">Remover espaços extras</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">Nome do Cliente</td>
                  <td className="border border-neutral-300 p-2">cliente_nome</td>
                  <td className="border border-neutral-300 p-2">Padronizar capitalização</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">Área</td>
                  <td className="border border-neutral-300 p-2">categoria</td>
                  <td className="border border-neutral-300 p-2">Mapear para lista padrão</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 p-2">Situação</td>
                  <td className="border border-neutral-300 p-2">status</td>
                  <td className="border border-neutral-300 p-2">Converter valores</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">⚙️ Transformações comuns</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Exemplos de conversão:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>"Em Andamento" → "Ativo"</li>
                <li>"Trabalho" → "Trabalhista"</li>
                <li>"João da Silva" → "João da Silva"</li>
                <li>"15/3/24" → "15/03/2024"</li>
                <li>"R$ 25.000,00" → "25000.00"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Fórmulas úteis (Excel):</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>=MAIÚSCULA(A1) - Texto em maiúsculas</li>
                <li>=ARRUMAR(A1) - Remove espaços extras</li>
                <li>=TEXTO(A1;"DD/MM/AAAA") - Formatar data</li>
                <li>=VALOR(A1) - Converter texto em número</li>
                <li>=SE(A1="Antigo";"Novo";A1) - Substituir valores</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        7. Backup e versionamento
      </h2>
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-3">
          💾 Estratégia de backup
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Versões a manter:</h4>
            <ul className="text-neutral-700 space-y-1">
              <li>• <strong>Original:</strong> Dados como exportados do sistema antigo</li>
              <li>• <strong>Limpos:</strong> Após limpeza e padronização</li>
              <li>• <strong>Finais:</strong> Prontos para importação</li>
              <li>• <strong>Importados:</strong> Confirmação do que foi enviado</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Nomenclatura sugerida:</h4>
            <ul className="text-neutral-700 space-y-1">
              <li>• processos_original_2024-03-15.xlsx</li>
              <li>• processos_limpo_2024-03-15.xlsx</li>
              <li>• processos_final_2024-03-15.xlsx</li>
              <li>• processos_lote1_importado.xlsx</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        8. Teste piloto
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
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Documente ajustes</h4>
            <p className="text-neutral-600 text-sm">Anote correções necessárias para aplicar no lote completo</p>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        9. Considerações especiais
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">🔒 Conformidade LGPD</h3>
          <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
            <li>Certifique-se de ter autorização para migrar dados pessoais</li>
            <li>Remova informações sensíveis desnecessárias (CPF, RG)</li>
            <li>Mantenha log de quais dados foram migrados</li>
            <li>Considere pseudonimização para dados de teste</li>
            <li>Documente base legal para tratamento dos dados</li>
          </ul>
        </div>

        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-2">⚡ Performance</h3>
          <ul className="list-disc list-inside text-green-700 space-y-1 text-sm">
            <li>Divida importações grandes em lotes de até 1.000 registros</li>
            <li>Execute importações fora do horário de pico</li>
            <li>Remova colunas desnecessárias para reduzir tamanho</li>
            <li>Use formato XLSX em vez de XLS para melhor performance</li>
            <li>Monitore uso de memória durante preparação de dados grandes</li>
          </ul>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ⚠️ Erros comuns a evitar
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li>Não fazer backup dos dados originais antes de modificar</li>
          <li>Não testar com amostra pequena antes da importação completa</li>
          <li>Misturar diferentes padrões de data no mesmo arquivo</li>
          <li>Não validar campos obrigatórios antes da importação</li>
          <li>Não documentar transformações feitas nos dados</li>
        </ul>
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