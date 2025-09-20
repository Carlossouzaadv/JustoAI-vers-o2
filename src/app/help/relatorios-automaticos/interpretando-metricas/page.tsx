import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function InterpretandoMetricasPage() {
  return (
    <HelpArticleLayout
      title="Interpretando métricas"
      category="Relatórios Automáticos"
      readTime="8 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Os relatórios da JustoAI incluem diversas métricas que ajudam a entender o desempenho do seu escritório e a evolução dos processos. Aprenda a interpretar cada indicador.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Métricas de produtividade
      </h2>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-3">📊 Processos analisados</h3>
          <p className="text-blue-700 mb-2">
            <strong>O que mede:</strong> Quantidade de documentos processados no período
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li><strong>Meta semanal:</strong> 15-25 análises por advogado</li>
            <li><strong>Tendência crescente:</strong> Indica maior eficiência</li>
            <li><strong>Picos isolados:</strong> Podem indicar sobrecarga</li>
            <li><strong>Compare com período anterior:</strong> Evolução da produtividade</li>
          </ul>
        </div>

        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-3">⏱️ Tempo médio de análise</h3>
          <p className="text-green-700 mb-2">
            <strong>O que mede:</strong> Velocidade de processamento dos documentos
          </p>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li><strong>Análise Essencial:</strong> 2-5 minutos (ideal)</li>
            <li><strong>Análise Estratégica:</strong> 8-12 minutos (ideal)</li>
            <li><strong>Análise Completa:</strong> 15-25 minutos (ideal)</li>
            <li><strong>Redução ao longo do tempo:</strong> Indica otimização</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Métricas de qualidade
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">🎖️ Precisão da análise</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">95-100%</div>
              <div className="text-sm text-green-700">Excelente</div>
              <p className="text-xs text-neutral-600 mt-1">Informações básicas sempre corretas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 mb-1">85-94%</div>
              <div className="text-sm text-yellow-700">Bom</div>
              <p className="text-xs text-neutral-600 mt-1">Pequenos ajustes podem ser necessários</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">&lt;85%</div>
              <div className="text-sm text-red-700">Atenção</div>
              <p className="text-xs text-neutral-600 mt-1">Verificar qualidade dos documentos</p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Métricas financeiras
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-3">💰 ROI (Retorno sobre Investimento)</h3>
          <p className="text-green-700 mb-2">
            <strong>Fórmula:</strong> (Economia gerada - Custo da ferramenta) ÷ Custo da ferramenta × 100
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Economia típica:</strong>
              <ul className="list-disc list-inside text-green-600 mt-1">
                <li>20h/semana por advogado</li>
                <li>R$ 100-200/hora economizada</li>
                <li>R$ 8.000-16.000/mês por advogado</li>
              </ul>
            </div>
            <div>
              <strong>ROI esperado:</strong>
              <ul className="list-disc list-inside text-green-600 mt-1">
                <li>Primeiro mês: 200-400%</li>
                <li>Após 3 meses: 500-800%</li>
                <li>Anualizado: 1000%+</li>
              </ul>
            </div>
            <div>
              <strong>Benefícios extras:</strong>
              <ul className="list-disc list-inside text-green-600 mt-1">
                <li>Maior satisfação do cliente</li>
                <li>Redução de erros</li>
                <li>Capacidade de atender mais casos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Interpretando tendências
        </h3>
        <p className="text-neutral-700 mb-3">
          Mais importante que números absolutos são as tendências ao longo do tempo:
        </p>
        <ul className="text-neutral-700 space-y-1 text-sm">
          <li>• <strong>Crescimento consistente:</strong> Indica adoção bem-sucedida</li>
          <li>• <strong>Picos e vales:</strong> Podem indicar sazonalidade</li>
          <li>• <strong>Declínio súbito:</strong> Investigate problemas técnicos ou de processo</li>
          <li>• <strong>Estabilização:</strong> Normal após período de adaptação</li>
        </ul>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Usando métricas para decisões
      </h2>
      <div className="space-y-3 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">🎯 Otimização de processos</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Baixa precisão:</strong> Melhorar qualidade dos uploads</li>
            <li><strong>Tempo alto:</strong> Usar análises mais simples para casos rotineiros</li>
            <li><strong>Baixo engajamento:</strong> Personalizar templates e conteúdo</li>
            <li><strong>ROI baixo:</strong> Aumentar volume de uso ou renegociar plano</li>
          </ul>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Usando métricas efetivamente
        </h3>
        <p className="text-neutral-700">
          Com essas métricas, você pode tomar decisões informadas sobre o uso da JustoAI, otimizar processos internos e demonstrar valor para clientes e sócios.
        </p>
      </div>

      <p className="text-neutral-700">
        Dúvidas sobre interpretação de métricas específicas? Nossa equipe pode ajudar em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}