/* eslint-disable react/no-unescaped-entities */
import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function SolucionandoErrosUploadPage() {
  return (
    <HelpArticleLayout
      title="Solucionando erros de upload"
      category="Uploads e Análises"
      readTime="5 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Problemas no upload podem acontecer por diversos motivos. Este guia ajuda você a identificar e resolver os erros mais comuns rapidamente.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Erros mais comuns e soluções
      </h2>

      <div className="space-y-6 mb-8">
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-red-800 mb-3">
            🚫 "Arquivo muito grande"
          </h3>
          <p className="text-red-700 mb-3">
            <strong>Causa:</strong> O arquivo excede o limite permitido para o formato.
          </p>
          <div className="text-red-700">
            <strong>Soluções:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Comprima o PDF usando ferramentas online ou Adobe Acrobat</li>
              <li>Divida documentos grandes em partes menores</li>
              <li>Reduza a qualidade de imagens dentro do documento</li>
              <li>Remove páginas desnecessárias ou anexos muito grandes</li>
            </ul>
          </div>
        </div>

        <div className="border border-orange-200 bg-orange-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-orange-800 mb-3">
            ⚠️ "Formato não suportado"
          </h3>
          <p className="text-orange-700 mb-3">
            <strong>Causa:</strong> Tipo de arquivo não aceito pela plataforma.
          </p>
          <div className="text-orange-700">
            <strong>Soluções:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Converta para PDF usando Google Docs, Word ou conversor online</li>
              <li>Para imagens: use JPEG ou PNG em vez de formatos exóticos</li>
              <li>Salve planilhas como Excel (.xlsx) ou CSV</li>
              <li>Exporte apresentações como PDF</li>
            </ul>
          </div>
        </div>

        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-yellow-800 mb-3">
            📶 "Falha na conexão"
          </h3>
          <p className="text-yellow-700 mb-3">
            <strong>Causa:</strong> Problemas de internet durante o upload.
          </p>
          <div className="text-yellow-700">
            <strong>Soluções:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verifique sua conexão com a internet</li>
              <li>Tente novamente em alguns minutos</li>
              <li>Use uma rede mais estável (cabo em vez de WiFi)</li>
              <li>Feche outras aplicações que usam internet</li>
            </ul>
          </div>
        </div>

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-blue-800 mb-3">
            🔒 "Arquivo protegido ou corrompido"
          </h3>
          <p className="text-blue-700 mb-3">
            <strong>Causa:</strong> PDF com senha ou arquivo danificado.
          </p>
          <div className="text-blue-700">
            <strong>Soluções:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Remova a proteção por senha do PDF</li>
              <li>Tente abrir o arquivo em outro programa para verificar se está íntegro</li>
              <li>Re-escaneie ou re-exporte o documento</li>
              <li>Use ferramentas de reparo de PDF se necessário</li>
            </ul>
          </div>
        </div>

        <div className="border border-purple-200 bg-purple-50 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-purple-800 mb-3">
            ⏱️ "Upload muito lento"
          </h3>
          <p className="text-purple-700 mb-3">
            <strong>Causa:</strong> Arquivo grande ou conexão lenta.
          </p>
          <div className="text-purple-700">
            <strong>Soluções:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Aguarde pacientemente - uploads grandes podem demorar</li>
              <li>Comprima o arquivo antes de fazer upload</li>
              <li>Faça upload durante horários de menor tráfego</li>
              <li>Não feche a aba do navegador durante o processo</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Problemas específicos por formato
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">PDF</h3>
          <ul className="text-neutral-700 space-y-2 text-sm">
            <li><strong>Senha:</strong> Remova proteção antes do upload</li>
            <li><strong>Escaneado:</strong> Certifique-se que o texto é legível</li>
            <li><strong>Múltiplos arquivos:</strong> Una em um só PDF quando possível</li>
            <li><strong>Versão antiga:</strong> Re-salve em versão mais recente</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Imagens</h3>
          <ul className="text-neutral-700 space-y-2 text-sm">
            <li><strong>Baixa resolução:</strong> Use no mínimo 300 DPI</li>
            <li><strong>Texto ilegível:</strong> Melhore iluminação ao fotografar</li>
            <li><strong>Formato exótico:</strong> Converta para JPEG ou PNG</li>
            <li><strong>Muito escura:</strong> Ajuste brilho e contraste</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Word</h3>
          <ul className="text-neutral-700 space-y-2 text-sm">
            <li><strong>Versão incompatível:</strong> Salve como .docx</li>
            <li><strong>Imagens incorporadas:</strong> Podem aumentar muito o tamanho</li>
            <li><strong>Formatação complexa:</strong> Converta para PDF</li>
            <li><strong>Macros:</strong> Salve sem macros habilitadas</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Planilhas</h3>
          <ul className="text-neutral-700 space-y-2 text-sm">
            <li><strong>Múltiplas abas:</strong> Organize dados na primeira aba</li>
            <li><strong>Fórmulas complexas:</strong> Cole valores em vez de fórmulas</li>
            <li><strong>Caracteres especiais:</strong> Use codificação UTF-8</li>
            <li><strong>Dados mistos:</strong> Separe texto de números</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Verificações antes do upload
      </h2>
      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-3">
          ✅ Checklist rápido
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li>□ Arquivo abre normalmente no meu computador</li>
          <li>□ Tamanho está dentro dos limites permitidos</li>
          <li>□ Formato é suportado pela JustoAI</li>
          <li>□ Não há proteção por senha</li>
          <li>□ Texto é legível e pesquisável</li>
          <li>□ Conexão com internet está estável</li>
          <li>□ Navegador está atualizado</li>
        </ul>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Ferramentas úteis para correção
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Compressão</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>SmallPDF (online)</li>
            <li>Adobe Acrobat (pago)</li>
            <li>PDFtk (gratuito)</li>
            <li>Ferramentas do Google Drive</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Conversão</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>Google Docs (gratuito)</li>
            <li>Microsoft Word Online</li>
            <li>LibreOffice (gratuito)</li>
            <li>Conversores online</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Quando solicitar suporte
      </h2>
      <p className="text-neutral-700 mb-4">
        Entre em contato conosco se:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>O erro persiste após tentar todas as soluções</li>
        <li>Você recebe mensagens de erro não listadas aqui</li>
        <li>O upload foi concluído mas a análise não funciona</li>
        <li>Precisa fazer upload de formatos específicos não suportados</li>
        <li>Tem arquivos muito grandes por necessidade legal</li>
      </ul>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          📞 Informações para o suporte
        </h3>
        <p className="text-neutral-700 mb-3">
          Ao entrar em contato, inclua:
        </p>
        <ul className="text-neutral-700 space-y-1 text-sm">
          <li>• Mensagem de erro exata</li>
          <li>• Tipo e tamanho do arquivo</li>
          <li>• Navegador e sistema operacional</li>
          <li>• Horário em que o erro ocorreu</li>
          <li>• Etapas que tentou para resolver</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Prevenção de problemas
        </h3>
        <p className="text-neutral-700">
          A maioria dos erros pode ser evitada verificando o formato e tamanho do arquivo antes do upload, e mantendo uma conexão de internet estável durante o processo.
        </p>
      </div>

      <p className="text-neutral-700">
        Problemas persistentes com upload? Nossa equipe está pronta para ajudar em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}