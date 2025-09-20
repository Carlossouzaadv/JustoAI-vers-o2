import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function ComoFuncionaAnaliseInteligenePage() {
  return (
    <HelpArticleLayout
      title="Como funciona a análise inteligente"
      category="Uploads e Análises"
      readTime="8 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        A análise inteligente da JustoAI utiliza tecnologia de ponta para extrair, organizar e interpretar informações jurídicas dos seus documentos. Entenda como funciona cada etapa do processo.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Processamento inicial do documento
      </h2>
      <p className="text-neutral-700 mb-4">
        Quando você faz upload de um documento, nossa IA inicia um processo estruturado:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Extração de texto:</strong> Converte PDFs e imagens em texto pesquisável</li>
        <li><strong>Limpeza de dados:</strong> Remove formatações desnecessárias e ruídos</li>
        <li><strong>Identificação de estrutura:</strong> Reconhece cabeçalhos, parágrafos e seções</li>
        <li><strong>OCR inteligente:</strong> Para documentos escaneados com baixa qualidade</li>
      </ul>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          🧠 Tecnologia utilizada
        </h3>
        <p className="text-neutral-700">
          Nossa IA combina modelos de linguagem especializados em direito brasileiro com algoritmos de processamento de texto jurídico, treinados especificamente para o contexto legal nacional.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Análise de conteúdo jurídico
      </h2>
      <p className="text-neutral-700 mb-4">
        A IA analisa o conteúdo em múltiplas camadas:
      </p>

      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Identificação de elementos jurídicos</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Partes envolvidas (autor, réu, terceiros)</li>
            <li>Números de processos e protocolos</li>
            <li>Datas importantes e prazos</li>
            <li>Valores monetários e cálculos</li>
            <li>Citações de leis e jurisprudência</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Classificação do tipo de documento</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1">
            <li>Petição inicial, contestação, sentença</li>
            <li>Área do direito (trabalhista, civil, criminal)</li>
            <li>Fase processual (conhecimento, execução)</li>
            <li>Urgência e complexidade do caso</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Tipos de análise disponíveis
      </h2>

      <div className="space-y-4 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-2">Análise Essencial (2-3 minutos)</h3>
          <p className="text-green-700 mb-2">
            <strong>Ideal para:</strong> Triagem rápida e acompanhamento de rotina
          </p>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li>Resumo objetivo em 3-5 parágrafos</li>
            <li>Identificação de partes e números</li>
            <li>Prazos críticos em destaque</li>
            <li>Classificação básica do documento</li>
          </ul>
        </div>

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">Análise Estratégica (5-7 minutos)</h3>
          <p className="text-blue-700 mb-2">
            <strong>Ideal para:</strong> Casos importantes que exigem acompanhamento detalhado
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li>Análise jurídica aprofundada</li>
            <li>Avaliação de chances de sucesso</li>
            <li>Identificação de riscos e oportunidades</li>
            <li>Sugestões de estratégias</li>
            <li>Timeline completa do processo</li>
          </ul>
        </div>

        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-purple-800 mb-2">Análise Completa (10-15 minutos)</h3>
          <p className="text-purple-700 mb-2">
            <strong>Ideal para:</strong> Casos complexos e de alto valor
          </p>
          <ul className="list-disc list-inside text-purple-600 space-y-1 text-sm">
            <li>Relatório executivo detalhado</li>
            <li>Análise completa de méritos</li>
            <li>Matriz de riscos personalizada</li>
            <li>Recomendações estratégicas específicas</li>
            <li>Precedentes e jurisprudência relevante</li>
            <li>Plano de ação sugerido</li>
          </ul>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          📊 Precisão da análise
        </h3>
        <p className="text-neutral-700 mb-3">
          Nossa IA tem precisão superior a 95% na identificação de elementos básicos e 88% na análise jurídica complexa, com melhoria contínua através de machine learning.
        </p>
        <p className="text-neutral-700 text-sm">
          <em>Importante: A análise é uma ferramenta de apoio e não substitui a análise jurídica profissional.</em>
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Próximos passos
        </h3>
        <p className="text-neutral-700">
          Agora que você entende como funciona nossa análise inteligente, experimente com diferentes tipos de documento para ver a IA em ação. Cada análise contribui para melhorar o sistema.
        </p>
      </div>

      <p className="text-neutral-700">
        Dúvidas sobre como a análise funciona? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}