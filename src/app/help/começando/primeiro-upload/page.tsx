import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function PrimeiroUploadPage() {
  return (
    <HelpArticleLayout
      title="Primeiro upload"
      category="Começando"
      readTime="4 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Fazer seu primeiro upload na JustoAI é simples e direto. Siga este guia para importar seus primeiros processos e começar a usar a análise inteligente.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Acesse a área de upload
      </h2>
      <p className="text-neutral-700 mb-4">
        No dashboard principal, clique no botão <strong>"Fazer Upload"</strong> ou na área central destacada "Arraste seus arquivos aqui".
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Selecione seus arquivos
      </h2>
      <p className="text-neutral-700 mb-4">
        A JustoAI aceita diversos formatos de arquivo:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>PDF:</strong> Petições, sentenças, documentos processuais</li>
        <li><strong>DOC/DOCX:</strong> Documentos do Microsoft Word</li>
        <li><strong>TXT:</strong> Arquivos de texto simples</li>
        <li><strong>JPEG/PNG:</strong> Imagens de documentos (com OCR automático)</li>
      </ul>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Qualidade dos arquivos
        </h3>
        <p className="text-neutral-700">
          Para melhores resultados, use arquivos com texto pesquisável. PDFs escaneados são aceitos, mas podem ter precisão reduzida na análise.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Configure as informações do processo
      </h2>
      <p className="text-neutral-700 mb-4">
        Após o upload, você pode adicionar informações importantes:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Número do processo:</strong> Para organização e busca</li>
        <li><strong>Cliente:</strong> Nome do cliente relacionado</li>
        <li><strong>Categoria:</strong> Tipo de direito (Trabalhista, Civil, etc.)</li>
        <li><strong>Prioridade:</strong> Urgente, Normal ou Baixa</li>
        <li><strong>Observações:</strong> Notas específicas sobre o caso</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Escolha o tipo de análise
      </h2>
      <p className="text-neutral-700 mb-4">
        Selecione o nível de análise desejado:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Análise Essencial:</strong> Resumo rápido e pontos principais (2-3 minutos)</li>
        <li><strong>Análise Estratégica:</strong> Avaliação jurídica detalhada (5-7 minutos)</li>
        <li><strong>Análise Completa:</strong> Relatório completo com estratégias (10-15 minutos)</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Acompanhe o processamento
      </h2>
      <p className="text-neutral-700 mb-4">
        Durante o processamento, você verá:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Barra de progresso em tempo real</li>
        <li>Etapas do processamento (Upload → Análise → Finalização)</li>
        <li>Estimativa de tempo restante</li>
        <li>Notificação quando concluída</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Visualize os resultados
      </h2>
      <p className="text-neutral-700 mb-4">
        Quando a análise estiver pronta, você terá acesso a:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Resumo executivo do processo</li>
        <li>Pontos importantes identificados</li>
        <li>Prazos e datas relevantes</li>
        <li>Recomendações estratégicas</li>
        <li>Documentos organizados por relevância</li>
      </ul>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          📋 Solução de problemas comuns
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li><strong>Arquivo muito grande:</strong> Divida em partes menores ou entre em contato</li>
          <li><strong>Formato não aceito:</strong> Converta para PDF antes do upload</li>
          <li><strong>Qualidade ruim:</strong> Use scanner com resolução mínima de 300 DPI</li>
          <li><strong>Processamento lento:</strong> Arquivos grandes podem demorar mais</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Primeiro upload concluído!
        </h3>
        <p className="text-neutral-700">
          Parabéns! Você completou seu primeiro upload. Explore os resultados da análise e familiarize-se com as funcionalidades disponíveis.
        </p>
      </div>

      <p className="text-neutral-700">
        Precisa de ajuda com o upload? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}