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

        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-purple-800 mb-3">🎯 Taxa de conclusão</h3>
          <p className="text-purple-700 mb-2">
            <strong>O que mede:</strong> Percentual de análises concluídas com sucesso
          </p>
          <ul className="list-disc list-inside text-purple-600 space-y-1 text-sm">
            <li><strong>Meta ideal:</strong> Acima de 95%</li>
            <li><strong>85-94%:</strong> Bom desempenho</li>
            <li><strong>Abaixo de 85%:</strong> Investigar problemas</li>
            <li><strong>Falhas comuns:</strong> Documentos ilegíveis ou corrompidos</li>
          </ul>
        </div>

        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-orange-800 mb-3">📈 Economia de tempo</h3>
          <p className="text-orange-700 mb-2">
            <strong>O que mede:</strong> Horas economizadas versus análise manual
          </p>
          <ul className="list-disc list-inside text-orange-600 space-y-1 text-sm">
            <li><strong>Cálculo:</strong> (Tempo manual - Tempo IA) × Quantidade</li>
            <li><strong>Média:</strong> 80-90% de redução no tempo</li>
            <li><strong>Por advogado:</strong> 15-20 horas/semana economizadas</li>
            <li><strong>Valor monetário:</strong> Economia × valor/hora</li>
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

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">📋 Completude das informações</h3>
          <p className="text-neutral-700 mb-3">Percentual de campos preenchidos automaticamente:</p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Dados básicos:</strong> 90-98% (partes, números, datas)</li>
            <li><strong>Valores monetários:</strong> 70-85% (nem sempre presentes)</li>
            <li><strong>Prazos:</strong> 80-95% (dependem do tipo de documento)</li>
            <li><strong>Análise jurídica:</strong> 75-90% (variável por complexidade)</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Métricas de engajamento
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">📧 Relatórios por email</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Taxa de entrega:</strong> &gt;95% (meta)</li>
            <li><strong>Taxa de abertura:</strong> 60-80% (clientes)</li>
            <li><strong>Cliques em links:</strong> 20-40%</li>
            <li><strong>Downloads de anexos:</strong> 40-70%</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">💬 Feedback dos usuários</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Avaliações positivas:</strong> &gt;80%</li>
            <li><strong>Correções sugeridas:</strong> &lt;20%</li>
            <li><strong>Solicitações de suporte:</strong> &lt;5%</li>
            <li><strong>Renovações de assinatura:</strong> &gt;90%</li>
          </ul>
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
        4. Métricas financeiras
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

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-3">📊 Custo por análise</h3>
          <p className="text-blue-700 mb-2">
            <strong>Cálculo:</strong> Custo mensal da ferramenta ÷ Número de análises realizadas
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li><strong>Meta ideal:</strong> R$ 5-15 por análise</li>
            <li><strong>Comparação:</strong> Custo manual: R$ 50-150 por análise</li>
            <li><strong>Economia:</strong> 85-95% de redução no custo</li>
            <li><strong>Melhoria:</strong> Custo diminui com maior volume</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Métricas por área do direito
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">⚖️ Direito Trabalhista</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Precisão em cálculos:</strong> 90-95%</li>
            <li><strong>Identificação de prazos:</strong> 95-98%</li>
            <li><strong>Valores envolvidos:</strong> 85-92%</li>
            <li><strong>Tempo médio:</strong> 5-8 minutos</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">🏠 Direito Civil</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Identificação de partes:</strong> 95-98%</li>
            <li><strong>Análise de contratos:</strong> 80-90%</li>
            <li><strong>Prazos processuais:</strong> 90-95%</li>
            <li><strong>Tempo médio:</strong> 8-12 minutos</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">🚨 Direito Criminal</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Identificação de crimes:</strong> 90-95%</li>
            <li><strong>Prazos críticos:</strong> 95-99%</li>
            <li><strong>Status de liberdade:</strong> 85-95%</li>
            <li><strong>Tempo médio:</strong> 6-10 minutos</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">💰 Direito Tributário</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Valores e multas:</strong> 92-97%</li>
            <li><strong>Datas de vencimento:</strong> 96-99%</li>
            <li><strong>Legislação citada:</strong> 85-92%</li>
            <li><strong>Tempo médio:</strong> 7-11 minutos</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Métricas de comparação
      </h2>
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-3">
          📈 Benchmarks do setor
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Escritórios pequenos (1-5 advogados)</h4>
            <ul className="text-neutral-700 space-y-1">
              <li>• 50-150 análises/mês</li>
              <li>• 60-80h economizadas/mês</li>
              <li>• ROI: 400-600%</li>
              <li>• Precisão: 90-95%</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-primary-700 mb-2">Escritórios médios (6-20 advogados)</h4>
            <ul className="text-neutral-700 space-y-1">
              <li>• 300-800 análises/mês</li>
              <li>• 200-400h economizadas/mês</li>
              <li>• ROI: 600-900%</li>
              <li>• Precisão: 92-96%</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        7. Usando métricas para decisões
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
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">📊 Relatórios para clientes</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Demonstre valor:</strong> Compartilhe métricas de economia</li>
            <li><strong>Transparência:</strong> Mostre velocidade e precisão</li>
            <li><strong>Evolução:</strong> Compare períodos para mostrar melhoria</li>
            <li><strong>Personalização:</strong> Destaque métricas relevantes para cada cliente</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        8. Alertas e ações automáticas
      </h2>
      <p className="text-neutral-700 mb-4">
        Configure alertas baseados em métricas para ação proativa:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Precisão &lt; 85%:</strong> Alerta para revisar documentos de entrada</li>
        <li><strong>Tempo &gt; 150% da média:</strong> Investigar problemas de performance</li>
        <li><strong>Volume baixo:</strong> Lembrete para equipe usar mais a ferramenta</li>
        <li><strong>Engajamento baixo:</strong> Revisar templates e frequência de relatórios</li>
        <li><strong>ROI &lt; 300%:</strong> Avaliar estratégia de uso da ferramenta</li>
      </ul>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ⚠️ Cuidados na interpretação
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li>Métricas podem variar conforme tipo de documento e complexidade</li>
          <li>Sempre considere contexto e sazonalidade do escritório</li>
          <li>Não tome decisões baseadas apenas em métricas isoladas</li>
          <li>Combine dados quantitativos com feedback qualitativo da equipe</li>
        </ul>
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