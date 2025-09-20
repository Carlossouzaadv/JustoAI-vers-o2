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
                <th className="border border-neutral-300 p-2 text-left">valor_causa</th>
                <th className="border border-neutral-300 p-2 text-left">observacoes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-neutral-300 p-2">1234567-89.2024.5.02.0001</td>
                <td className="border border-neutral-300 p-2">João Silva</td>
                <td className="border border-neutral-300 p-2">Trabalhista</td>
                <td className="border border-neutral-300 p-2">Ativo</td>
                <td className="border border-neutral-300 p-2">15/03/2024</td>
                <td className="border border-neutral-300 p-2">25000.00</td>
                <td className="border border-neutral-300 p-2">Rescisão indireta</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-neutral-600 text-sm mt-3">
          <strong>Dica:</strong> Baixe nosso template Excel pré-formatado na seção "Importar Dados" do dashboard.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Campos obrigatórios e opcionais
      </h2>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-3">✅ Campos obrigatórios</h3>
          <ul className="list-disc list-inside text-green-700 space-y-2 text-sm">
            <li><strong>numero_processo:</strong> Identificação única do processo</li>
            <li><strong>cliente_nome:</strong> Nome do cliente (pessoa física ou jurídica)</li>
            <li><strong>categoria:</strong> Área do direito (Trabalhista, Civil, etc.)</li>
            <li><strong>status:</strong> Ativo, Arquivado, Finalizado</li>
          </ul>
        </div>
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-3">📋 Campos opcionais</h3>
          <ul className="list-disc list-inside text-blue-700 space-y-2 text-sm">
            <li><strong>data_abertura:</strong> Data de início (DD/MM/AAAA)</li>
            <li><strong>valor_causa:</strong> Valor monetário (apenas números)</li>
            <li><strong>advogado_responsavel:</strong> Nome do advogado</li>
            <li><strong>observacoes:</strong> Notas e comentários adicionais</li>
            <li><strong>prioridade:</strong> Alta, Média, Baixa</li>
            <li><strong>comarca:</strong> Local de tramitação</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Formatação de dados
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">📅 Datas</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Formato aceito:</strong> DD/MM/AAAA (15/03/2024)</li>
            <li><strong>Formato alternativo:</strong> AAAA-MM-DD (2024-03-15)</li>
            <li><strong>Evite:</strong> Formatos americanos (MM/DD/AAAA)</li>
            <li><strong>Dica:</strong> Configure a coluna como "Data" no Excel</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">💰 Valores monetários</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Formato aceito:</strong> 25000.00 (ponto como separador decimal)</li>
            <li><strong>Sem símbolos:</strong> Não inclua R$, vírgulas ou espaços</li>
            <li><strong>Para valores grandes:</strong> 1500000.00 (1,5 milhão)</li>
            <li><strong>Centavos:</strong> Sempre use duas casas decimais</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">📝 Textos</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Codificação:</strong> UTF-8 para acentos e caracteres especiais</li>
            <li><strong>Aspas:</strong> Use aspas duplas se o texto contém vírgulas</li>
            <li><strong>Quebras de linha:</strong> Evite em campos de texto</li>
            <li><strong>Limite:</strong> Máximo 500 caracteres por campo</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Categorias padronizadas
      </h2>
      <p className="text-neutral-700 mb-4">
        Use exatamente estas categorias para garantir classificação correta:
      </p>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Áreas principais</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
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
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Status válidos</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
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

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Campos personalizados
        </h3>
        <p className="text-neutral-700">
          Se sua planilha tem categorias diferentes, você pode mapeá-las durante a importação. O sistema sugerirá correspondências automáticas baseadas no conteúdo.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Processo de importação
      </h2>
      <div className="space-y-3 mb-6">
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Upload da planilha</h4>
            <p className="text-neutral-600 text-sm">Acesse "Importar Dados" no dashboard e faça upload do arquivo Excel/CSV</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Mapeamento de campos</h4>
            <p className="text-neutral-600 text-sm">Confirme ou ajuste a correspondência entre colunas da planilha e campos do sistema</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Validação de dados</h4>
            <p className="text-neutral-600 text-sm">O sistema verifica erros e inconsistências, sugerindo correções</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
          <span className="bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
          <div>
            <h4 className="font-semibold text-neutral-800">Importação final</h4>
            <p className="text-neutral-600 text-sm">Confirme a importação e acompanhe o progresso em tempo real</p>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Validação e correção de erros
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-red-800 mb-2">🚫 Erros comuns</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
            <li><strong>Números de processo duplicados:</strong> Cada processo deve ser único</li>
            <li><strong>Datas inválidas:</strong> Verifique formato DD/MM/AAAA</li>
            <li><strong>Categorias incorretas:</strong> Use apenas as categorias listadas</li>
            <li><strong>Campos obrigatórios vazios:</strong> Preencha todos os campos necessários</li>
            <li><strong>Caracteres especiais:</strong> Problemas de codificação UTF-8</li>
          </ul>
        </div>

        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-yellow-800 mb-2">⚠️ Avisos (não impedem importação)</h3>
          <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
            <li><strong>Valores muito altos/baixos:</strong> Confirmação manual necessária</li>
            <li><strong>Datas futuras:</strong> Processos com datas no futuro</li>
            <li><strong>Nomes similares:</strong> Possíveis clientes duplicados</li>
            <li><strong>Campos vazios opcionais:</strong> Dados que podem ser preenchidos depois</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        7. Limites e restrições
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">📊 Limites por importação</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Máximo:</strong> 5.000 processos por vez</li>
            <li><strong>Tamanho:</strong> Até 25MB por arquivo</li>
            <li><strong>Colunas:</strong> Máximo 50 campos</li>
            <li><strong>Tempo:</strong> Processamento em até 30 minutos</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">⏱️ Frequência</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Importações/dia:</strong> Até 10 por usuário</li>
            <li><strong>Intervalo mínimo:</strong> 5 minutos entre importações</li>
            <li><strong>Horário recomendado:</strong> 8h às 18h</li>
            <li><strong>Backup automático:</strong> Dados anteriores preservados</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        8. Pós-importação
      </h2>
      <p className="text-neutral-700 mb-4">
        Após a importação bem-sucedida:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Verificação manual:</strong> Revise uma amostra dos dados importados</li>
        <li><strong>Análise automática:</strong> A IA pode analisar processos recém-importados</li>
        <li><strong>Configuração de relatórios:</strong> Configure relatórios para os novos dados</li>
        <li><strong>Organização:</strong> Crie categorias e tags conforme necessário</li>
        <li><strong>Backup:</strong> Mantenha cópia da planilha original</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        9. Importações incrementais
      </h2>
      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-3">
          🔄 Atualizações periódicas
        </h3>
        <p className="text-neutral-700 mb-3">
          Para manter dados sempre atualizados:
        </p>
        <ul className="list-disc list-inside text-neutral-700 space-y-1 text-sm">
          <li><strong>Identifique mudanças:</strong> Use data de modificação para filtrar registros</li>
          <li><strong>Modo de atualização:</strong> Escolha entre "substituir" ou "adicionar"</li>
          <li><strong>Campos de controle:</strong> Use coluna "data_ultima_atualizacao"</li>
          <li><strong>Automatização:</strong> Configure importações regulares (semanal/mensal)</li>
        </ul>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        10. Melhores práticas
      </h2>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Teste com pequena amostra:</strong> Importe 10-20 registros primeiro</li>
        <li><strong>Padronize dados:</strong> Limpe e organize antes da importação</li>
        <li><strong>Documente mapeamentos:</strong> Salve configurações para reutilização</li>
        <li><strong>Horário adequado:</strong> Importe fora do horário de pico</li>
        <li><strong>Monitore resultados:</strong> Acompanhe métricas pós-importação</li>
        <li><strong>Treine equipe:</strong> Garanta que todos saibam o processo</li>
      </ul>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ⚠️ Cuidados importantes
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li>Sempre faça backup dos dados antes de importações grandes</li>
          <li>Verifique LGPD - certifique-se de ter autorização para todos os dados</li>
          <li>Dados sensíveis devem ser importados com cuidado extra</li>
          <li>Mantenha log das importações para auditoria</li>
        </ul>
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