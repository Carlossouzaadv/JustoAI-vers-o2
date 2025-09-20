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
        </ul>
      </div>

      <p className="text-neutral-700">
        Precisa fazer upload de um formato não listado? Entre em contato em <strong>suporte@justoai.com.br</strong> - podemos avaliar incluí-lo.
      </p>
    </HelpArticleLayout>
  );
}