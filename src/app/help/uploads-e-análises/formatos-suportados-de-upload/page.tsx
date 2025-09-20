import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function FormatosSuportadosUploadPage() {
  return (
    <HelpArticleLayout
      title="Formatos suportados de upload"
      category="Uploads e Análises"
      readTime="4 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        A JustoAI aceita diversos formatos de arquivo para garantir que você possa trabalhar com qualquer tipo de documento jurídico. Conheça todos os formatos suportados e suas particularidades.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Documentos de texto
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">PDF (.pdf)</h3>
          <p className="text-neutral-700 mb-2">
            <strong>Recomendado:</strong> Formato ideal para documentos jurídicos
          </p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 50MB por arquivo</li>
            <li>Textos pesquisáveis têm melhor precisão</li>
            <li>PDFs escaneados são aceitos (com OCR automático)</li>
            <li>Suporte a múltiplas páginas</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Microsoft Word (.doc, .docx)</h3>
          <p className="text-neutral-700 mb-2">
            <strong>Excelente precisão:</strong> Texto estruturado facilita a análise
          </p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 25MB por arquivo</li>
            <li>Preserva formatação e estrutura</li>
            <li>Compatível com todas as versões do Word</li>
            <li>Ideal para petições e pareceres</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Texto Simples (.txt)</h3>
          <p className="text-neutral-700 mb-2">
            <strong>Processamento rápido:</strong> Para textos sem formatação
          </p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 10MB por arquivo</li>
            <li>Análise mais rápida</li>
            <li>Ideal para transcrições</li>
            <li>Codificação UTF-8 recomendada</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Imagens de documentos
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">JPEG (.jpg, .jpeg)</h3>
          <p className="text-neutral-700 mb-2">
            <strong>Com OCR automático:</strong> Converte imagem em texto
          </p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 20MB por arquivo</li>
            <li>Resolução mínima: 300 DPI</li>
            <li>Ideal para documentos fotografados</li>
            <li>Processamento pode levar mais tempo</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">PNG (.png)</h3>
          <p className="text-neutral-700 mb-2">
            <strong>Alta qualidade:</strong> Melhor para textos escaneados
          </p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 30MB por arquivo</li>
            <li>Melhor qualidade que JPEG</li>
            <li>Ideal para screenshots de sistemas</li>
            <li>Preserva nitidez do texto</li>
          </ul>
        </div>
      </div>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica para melhor qualidade
        </h3>
        <p className="text-neutral-700">
          Para obter os melhores resultados na análise, sempre prefira documentos com texto pesquisável (PDF ou Word) em vez de imagens escaneadas.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Planilhas e dados estruturados
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Excel (.xls, .xlsx)</h3>
          <p className="text-neutral-700 mb-2">
            <strong>Para importação em lote:</strong> Liste múltiplos processos
          </p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 15MB por arquivo</li>
            <li>Use nosso template para estruturar dados</li>
            <li>Ideal para migração de sistemas</li>
            <li>Suporte a múltiplas abas</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">CSV (.csv)</h3>
          <p className="text-neutral-700 mb-2">
            <strong>Formato universal:</strong> Compatible com qualquer sistema
          </p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 10MB por arquivo</li>
            <li>Codificação UTF-8 obrigatória</li>
            <li>Separador: vírgula ou ponto e vírgula</li>
            <li>Primeira linha deve conter cabeçalhos</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Formatos não suportados
      </h2>
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <p className="text-neutral-700 mb-4">
          Os seguintes formatos <strong>não são aceitos</strong> atualmente:
        </p>
        <ul className="list-disc list-inside text-neutral-700 space-y-2">
          <li><strong>Arquivos compactados:</strong> ZIP, RAR, 7Z</li>
          <li><strong>Vídeos:</strong> MP4, AVI, MOV</li>
          <li><strong>Áudios:</strong> MP3, WAV, M4A</li>
          <li><strong>Apresentações:</strong> PPT, PPTX</li>
          <li><strong>Outros:</strong> EXE, DMG, ISO</li>
        </ul>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Limites e restrições
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Por upload</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Máximo: 10 arquivos simultâneos</li>
            <li>Total: até 500MB por upload</li>
            <li>Processamento: até 2 horas</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Por conta</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Armazenamento: 50GB (plano básico)</li>
            <li>Uploads diários: sem limite</li>
            <li>Retenção: dados mantidos por 5 anos</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Preparando arquivos para upload
      </h2>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Nomeação clara:</strong> Use nomes descritivos para os arquivos</li>
        <li><strong>Organização:</strong> Agrupe documentos relacionados</li>
        <li><strong>Qualidade:</strong> Escaneie documentos em alta resolução</li>
        <li><strong>Completude:</strong> Inclua todas as páginas relevantes</li>
        <li><strong>Privacidade:</strong> Remova informações sensíveis desnecessárias</li>
      </ul>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          🔧 Problemas com upload?
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li><strong>Arquivo muito grande:</strong> Divida em partes menores</li>
          <li><strong>Formato não aceito:</strong> Converta para PDF</li>
          <li><strong>Erro de upload:</strong> Verifique sua conexão</li>
          <li><strong>Processamento lento:</strong> Aguarde ou contate suporte</li>
        </ul>
      </div>

      <p className="text-neutral-700">
        Precisa fazer upload de um formato não listado? Entre em contato em <strong>suporte@justoai.com.br</strong> - podemos avaliar incluí-lo.
      </p>
    </HelpArticleLayout>
  );
}