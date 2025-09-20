import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function FormatosPlanilhaSuportadosPage() {
  return (
    <HelpArticleLayout
      title="Formatos de planilha suportados"
      category="Integrações"
      readTime="4 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        A JustoAI aceita diversos formatos de planilha para importação de dados. Conheça todos os formatos suportados e suas especificações técnicas.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Formatos aceitos
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-2">📊 Microsoft Excel (.xlsx)</h3>
          <p className="text-green-700 mb-2">
            <strong>Recomendado:</strong> Formato moderno do Excel com melhor compatibilidade
          </p>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li><strong>Versões:</strong> Excel 2007 ou superior</li>
            <li><strong>Tamanho máximo:</strong> 25MB</li>
            <li><strong>Linhas:</strong> Até 100.000 registros</li>
            <li><strong>Colunas:</strong> Até 50 campos</li>
            <li><strong>Múltiplas abas:</strong> Suportado (primeira aba usada por padrão)</li>
            <li><strong>Fórmulas:</strong> Convertidas para valores durante importação</li>
          </ul>
        </div>

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">📈 Microsoft Excel (.xls)</h3>
          <p className="text-blue-700 mb-2">
            <strong>Legado:</strong> Formato clássico do Excel (compatibilidade limitada)
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li><strong>Versões:</strong> Excel 97-2003</li>
            <li><strong>Tamanho máximo:</strong> 15MB</li>
            <li><strong>Linhas:</strong> Até 65.000 registros</li>
            <li><strong>Limitações:</strong> Menos recursos que .xlsx</li>
            <li><strong>Recomendação:</strong> Converta para .xlsx quando possível</li>
          </ul>
        </div>

        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-purple-800 mb-2">📋 CSV (Comma Separated Values)</h3>
          <p className="text-purple-700 mb-2">
            <strong>Universal:</strong> Formato texto compatível com qualquer sistema
          </p>
          <ul className="list-disc list-inside text-purple-600 space-y-1 text-sm">
            <li><strong>Codificação:</strong> UTF-8 obrigatória</li>
            <li><strong>Separadores:</strong> Vírgula (,) ou ponto e vírgula (;)</li>
            <li><strong>Tamanho máximo:</strong> 20MB</li>
            <li><strong>Aspas:</strong> Necessárias para campos com separadores</li>
            <li><strong>Primeira linha:</strong> Deve conter nomes das colunas</li>
          </ul>
        </div>

        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-orange-800 mb-2">📊 OpenDocument (.ods)</h3>
          <p className="text-orange-700 mb-2">
            <strong>Código aberto:</strong> Formato do LibreOffice Calc
          </p>
          <ul className="list-disc list-inside text-orange-600 space-y-1 text-sm">
            <li><strong>Compatibilidade:</strong> LibreOffice, Google Sheets</li>
            <li><strong>Tamanho máximo:</strong> 20MB</li>
            <li><strong>Recursos:</strong> Similar ao Excel</li>
            <li><strong>Conversão:</strong> Pode ser necessária para melhor compatibilidade</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Especificações técnicas
      </h2>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Limites gerais</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>Registros máximos:</strong> 100.000 por importação</li>
            <li><strong>Campos máximos:</strong> 50 colunas</li>
            <li><strong>Tamanho do arquivo:</strong> 25MB (.xlsx) / 20MB (outros)</li>
            <li><strong>Tempo de processamento:</strong> Até 30 minutos</li>
            <li><strong>Caracteres por campo:</strong> 1.000 caracteres</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Requisitos de formato</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>Cabeçalhos:</strong> Obrigatórios na primeira linha</li>
            <li><strong>Células vazias:</strong> Permitidas (campos opcionais)</li>
            <li><strong>Formatação:</strong> Preservada quando possível</li>
            <li><strong>Duplicatas:</strong> Identificadas automaticamente</li>
            <li><strong>Validação:</strong> Verificação automática de dados</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Configurações específicas por formato
      </h2>

      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Excel (.xlsx/.xls)</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Configurações recomendadas:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>Use a primeira aba para dados principais</li>
                <li>Formate colunas de data como "Data"</li>
                <li>Configure números com separador decimal (ponto)</li>
                <li>Remova formatação condicional complexa</li>
                <li>Evite células mescladas</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Problemas comuns:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>Fórmulas que geram erros (#N/A, #REF!)</li>
                <li>Datas em formato texto</li>
                <li>Valores com formatação monetária</li>
                <li>Linhas totalmente vazias</li>
                <li>Caracteres especiais não suportados</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">CSV</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Estrutura correta:</h4>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>Codificação UTF-8 (para acentos)</li>
                <li>Primeira linha com nomes das colunas</li>
                <li>Vírgula ou ponto e vírgula como separador</li>
                <li>Aspas duplas para campos com separadores</li>
                <li>Quebras de linha apenas entre registros</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Exemplo válido:</h4>
              <div className="bg-neutral-100 p-2 rounded font-mono text-xs">
                numero_processo,cliente,categoria<br/>
                "123-45.2024","João Silva","Trabalhista"<br/>
                "456-78.2024","Maria Santos","Civil"
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Qual formato escolher?
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li><strong>Excel (.xlsx):</strong> Melhor opção para a maioria dos casos - suporte completo a formatação</li>
          <li><strong>CSV:</strong> Ideal para sistemas automatizados e grandes volumes de dados</li>
          <li><strong>Excel (.xls):</strong> Apenas se necessário para compatibilidade com sistemas antigos</li>
          <li><strong>ODS:</strong> Para usuários de LibreOffice que não podem converter para Excel</li>
        </ul>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Preparação de dados
      </h2>
      <div className="space-y-3 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Antes da exportação</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Limpe dados:</strong> Remova linhas vazias e dados desnecessários</li>
            <li><strong>Padronize formatos:</strong> Datas, números e textos consistentes</li>
            <li><strong>Valide informações:</strong> Verifique dados obrigatórios</li>
            <li><strong>Organize colunas:</strong> Campos mais importantes primeiro</li>
            <li><strong>Teste pequena amostra:</strong> 10-20 registros para validação</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Durante a exportação</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Salvar como .xlsx:</strong> Formato recomendado para Excel</li>
            <li><strong>Para CSV:</strong> Escolha UTF-8 na codificação</li>
            <li><strong>Verificar separadores:</strong> Vírgula para internacional, ponto e vírgula para Brasil</li>
            <li><strong>Incluir cabeçalhos:</strong> Primeira linha com nomes das colunas</li>
            <li><strong>Testar abertura:</strong> Abra o arquivo para verificar se está correto</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Formatos não suportados
      </h2>
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-red-800 mb-3">❌ Formatos não aceitos</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              <li><strong>Números (.numbers):</strong> Apple Numbers</li>
              <li><strong>Sheets do Google:</strong> Exporte como Excel/CSV</li>
              <li><strong>PDF:</strong> Não é planilha editável</li>
              <li><strong>XML:</strong> Estrutura muito complexa</li>
              <li><strong>DBF:</strong> Formato de banco antigo</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-red-800 mb-2">Como converter:</h4>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              <li>Google Sheets → Arquivo → Download → Excel</li>
              <li>Numbers → Arquivo → Exportar → Excel</li>
              <li>PDF → Use OCR ou redigite os dados</li>
              <li>Outros → Abra no Excel e salve como .xlsx</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Validação automática
      </h2>
      <p className="text-neutral-700 mb-4">
        Durante a importação, o sistema verifica automaticamente:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Formato do arquivo:</strong> Se é um tipo suportado</li>
        <li><strong>Estrutura dos dados:</strong> Presença de cabeçalhos e colunas válidas</li>
        <li><strong>Integridade:</strong> Dados corrompidos ou ilegíveis</li>
        <li><strong>Tamanho:</strong> Se está dentro dos limites permitidos</li>
        <li><strong>Codificação:</strong> Caracteres especiais e acentos</li>
        <li><strong>Duplicatas:</strong> Registros repetidos</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Solução de problemas
      </h2>
      <div className="space-y-3 mb-6">
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-yellow-800 mb-2">⚠️ Arquivo não reconhecido</h3>
          <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
            <li>Verifique se a extensão está correta (.xlsx, .csv, etc.)</li>
            <li>Abra e salve novamente no formato correto</li>
            <li>Certifique-se que o arquivo não está corrompido</li>
            <li>Teste com uma versão mais simples do arquivo</li>
          </ul>
        </div>
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-red-800 mb-2">🚫 Dados ilegíveis</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
            <li>Para CSV: Use codificação UTF-8</li>
            <li>Remova caracteres especiais problemáticos</li>
            <li>Simplifique formatação complexa</li>
            <li>Exporte novamente do sistema original</li>
          </ul>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          🔧 Ferramentas úteis
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li><strong>LibreOffice Calc:</strong> Gratuito, converte entre formatos</li>
          <li><strong>Google Sheets:</strong> Online, boa para CSV</li>
          <li><strong>Notepad++:</strong> Para editar CSV com codificação correta</li>
          <li><strong>Excel Online:</strong> Versão gratuita do Microsoft Excel</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Resumo das melhores práticas
        </h3>
        <p className="text-neutral-700">
          Use Excel (.xlsx) sempre que possível, mantenha dados limpos e organizados, teste com pequenas amostras primeiro, e sempre mantenha backup dos arquivos originais.
        </p>
      </div>

      <p className="text-neutral-700">
        Problemas com formato de planilha específico? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}