import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function InterpretandoResultadosAnalise() {
  return (
    <HelpArticleLayout
      title="Interpretando resultados da análise"
      category="Uploads e Análises"
      readTime="6 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Após a análise ser concluída, você recebe um relatório estruturado com diversas informações. Aprenda a interpretar cada seção e usar os insights da melhor forma possível.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Resumo executivo
      </h2>
      <p className="text-neutral-700 mb-4">
        A primeira seção oferece uma visão geral do documento:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Tipo de documento:</strong> Petição, sentença, acordo, etc.</li>
        <li><strong>Partes envolvidas:</strong> Quem são autor, réu e terceiros</li>
        <li><strong>Resumo em 2-3 parágrafos:</strong> O que o documento diz essencialmente</li>
        <li><strong>Status atual:</strong> Em que fase o processo se encontra</li>
        <li><strong>Área do direito:</strong> Trabalhista, civil, criminal, etc.</li>
      </ul>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Como usar o resumo
        </h3>
        <p className="text-neutral-700">
          Use o resumo executivo para decidir rapidamente a prioridade do caso e se precisa de atenção imediata. É ideal para apresentações a clientes ou colegas.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Alertas e prazos críticos
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-red-800 mb-2">🚨 Urgente (até 5 dias)</h3>
          <p className="text-red-700">
            Prazos que vencem em breve e precisam de ação imediata. A IA destaca automaticamente essas datas.
          </p>
        </div>
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-yellow-800 mb-2">⚠️ Atenção (5-15 dias)</h3>
          <p className="text-yellow-700">
            Prazos que se aproximam e devem ser incluídos no planejamento semanal.
          </p>
        </div>
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">📅 Programado (mais de 15 dias)</h3>
          <p className="text-blue-700">
            Datas futuras importantes para acompanhamento e planejamento de longo prazo.
          </p>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Métricas de risco e oportunidade
      </h2>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4 text-center">
          <h3 className="font-semibold text-lg text-green-700 mb-2">Baixo Risco</h3>
          <div className="text-3xl font-bold text-green-600 mb-2">85-100%</div>
          <p className="text-sm text-neutral-600">Alta probabilidade de resultado favorável</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4 text-center">
          <h3 className="font-semibold text-lg text-yellow-700 mb-2">Médio Risco</h3>
          <div className="text-3xl font-bold text-yellow-600 mb-2">50-84%</div>
          <p className="text-sm text-neutral-600">Requer estratégia cuidadosa</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4 text-center">
          <h3 className="font-semibold text-lg text-red-700 mb-2">Alto Risco</h3>
          <div className="text-3xl font-bold text-red-600 mb-2">0-49%</div>
          <p className="text-sm text-neutral-600">Necessita revisão estratégica</p>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          📊 Como interpretar as métricas
        </h3>
        <p className="text-neutral-700">
          As métricas são baseadas em análise de jurisprudência, força dos argumentos apresentados e complexidade do caso. Use como orientação, não como determinante absoluto.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Recomendações estratégicas
      </h2>
      <p className="text-neutral-700 mb-4">
        A IA sugere próximas ações baseadas na análise:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Ações imediatas:</strong> O que fazer nos próximos dias</li>
        <li><strong>Estratégias de médio prazo:</strong> Planejamento para próximas semanas</li>
        <li><strong>Documentos adicionais:</strong> Provas que podem fortalecer o caso</li>
        <li><strong>Pontos de atenção:</strong> Riscos específicos a monitorar</li>
        <li><strong>Oportunidades:</strong> Argumentos que podem ser explorados</li>
      </ul>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ⚠️ Limitações importantes
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li>A análise é uma ferramenta de apoio, não substitui avaliação jurídica profissional</li>
          <li>Documentos incompletos podem gerar análises parciais</li>
          <li>Casos muito específicos podem ter insights limitados</li>
          <li>Sempre valide informações críticas manualmente</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Dica final
        </h3>
        <p className="text-neutral-700">
          Use a análise como ponto de partida para sua estratégia jurídica. Combine os insights da IA com sua experiência profissional para obter os melhores resultados.
        </p>
      </div>

      <p className="text-neutral-700">
        Dúvidas sobre como interpretar uma análise específica? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}