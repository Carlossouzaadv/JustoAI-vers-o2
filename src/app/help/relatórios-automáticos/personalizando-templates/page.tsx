import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function PersonalizandoTemplatesPage() {
  return (
    <HelpArticleLayout
      title="Personalizando templates"
      category="Relatórios Automáticos"
      readTime="7 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Personalize seus templates de relatório para refletir a identidade do seu escritório e atender às necessidades específicas de cada tipo de cliente e situação.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Acesse o editor de templates
      </h2>
      <p className="text-neutral-700 mb-4">
        Para começar a personalizar seus templates:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Vá em <strong>Configurações → Templates de Relatório</strong></li>
        <li>Clique em <strong>"Personalizar Template"</strong> no relatório desejado</li>
        <li>Ou escolha <strong>"Criar Novo Template"</strong> para começar do zero</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Identidade visual do escritório
      </h2>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Logo e cabeçalho</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>Logo:</strong> Upload da marca do escritório (PNG/JPG)</li>
            <li><strong>Nome do escritório:</strong> Razão social completa</li>
            <li><strong>Slogan:</strong> Frase institucional (opcional)</li>
            <li><strong>Posicionamento:</strong> Esquerda, centro ou direita</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Cores e tipografia</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>Cor principal:</strong> Cor da marca para títulos</li>
            <li><strong>Cor secundária:</strong> Destaques e elementos</li>
            <li><strong>Fonte:</strong> Escolha entre opções profissionais</li>
            <li><strong>Tamanho:</strong> Ajuste para legibilidade</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Informações de contato
      </h2>
      <p className="text-neutral-700 mb-4">
        Configure os dados que aparecerão no rodapé dos relatórios:
      </p>
      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-3">
          📞 Dados de contato obrigatórios
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <ul className="text-neutral-700 space-y-1">
              <li>• <strong>Endereço completo:</strong> Rua, número, cidade, CEP</li>
              <li>• <strong>Telefone principal:</strong> Fixo do escritório</li>
              <li>• <strong>WhatsApp Business:</strong> Para contato rápido</li>
              <li>• <strong>Email institucional:</strong> contato@escritorio.com</li>
            </ul>
          </div>
          <div>
            <ul className="text-neutral-700 space-y-1">
              <li>• <strong>OAB responsável:</strong> Número da inscrição</li>
              <li>• <strong>CNPJ:</strong> Registro da empresa</li>
              <li>• <strong>Site:</strong> www.escritorio.com.br</li>
              <li>• <strong>Redes sociais:</strong> LinkedIn, Instagram (opcional)</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Templates por tipo de cliente
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">👔 Clientes empresariais</h3>
          <p className="text-blue-700 mb-2">
            <strong>Características:</strong> Formal, técnico, focado em métricas
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li>Linguagem técnica jurídica apropriada</li>
            <li>Gráficos e métricas de performance</li>
            <li>Análises de risco detalhadas</li>
            <li>Comparações com períodos anteriores</li>
            <li>Recomendações estratégicas de negócio</li>
          </ul>
        </div>

        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-2">👨‍👩‍👧‍👦 Pessoas físicas</h3>
          <p className="text-green-700 mb-2">
            <strong>Características:</strong> Linguagem acessível, educativo
          </p>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li>Explicações em linguagem simples</li>
            <li>Glossário de termos jurídicos</li>
            <li>Próximos passos claramente explicados</li>
            <li>Cronograma visual do processo</li>
            <li>Seção de perguntas frequentes</li>
          </ul>
        </div>

        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-purple-800 mb-2">🏢 Departamentos jurídicos</h3>
          <p className="text-purple-700 mb-2">
            <strong>Características:</strong> Dados estruturados, compliance
          </p>
          <ul className="list-disc list-inside text-purple-600 space-y-1 text-sm">
            <li>Dashboards com KPIs jurídicos</li>
            <li>Relatórios de compliance</li>
            <li>Análises de tendências</li>
            <li>Comparativos setoriais</li>
            <li>Alertas de mudanças regulatórias</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        5. Seções personalizáveis
      </h2>
      <p className="text-neutral-700 mb-4">
        Configure quais seções incluir e sua ordem de apresentação:
      </p>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-primary-700">Seções principais</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked readOnly className="rounded" />
              <span className="text-neutral-700">Resumo executivo</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked readOnly className="rounded" />
              <span className="text-neutral-700">Atualizações importantes</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked readOnly className="rounded" />
              <span className="text-neutral-700">Prazos e datas críticas</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" readOnly className="rounded" />
              <span className="text-neutral-700">Análise de riscos</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" readOnly className="rounded" />
              <span className="text-neutral-700">Recomendações estratégicas</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-primary-700">Seções opcionais</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" readOnly className="rounded" />
              <span className="text-neutral-700">Gráficos e métricas</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" readOnly className="rounded" />
              <span className="text-neutral-700">Histórico de ações</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" readOnly className="rounded" />
              <span className="text-neutral-700">Jurisprudência relevante</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" readOnly className="rounded" />
              <span className="text-neutral-700">Glossário jurídico</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" readOnly className="rounded" />
              <span className="text-neutral-700">Anexos e documentos</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Personalização de conteúdo
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Textos personalizados</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>Introdução padrão:</strong> Texto de abertura personalizado</li>
            <li><strong>Assinatura:</strong> Mensagem de encerramento</li>
            <li><strong>Disclaimers:</strong> Avisos legais específicos</li>
            <li><strong>Call-to-action:</strong> Orientações para próximos passos</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Variáveis dinâmicas</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>{'{{cliente_nome}}'}:</strong> Nome do cliente</li>
            <li><strong>{'{{processo_numero}}'}:</strong> Número do processo</li>
            <li><strong>{'{{data_relatorio}}'}:</strong> Data de geração</li>
            <li><strong>{'{{advogado_responsavel}}'}:</strong> Nome do advogado</li>
            <li><strong>{'{{periodo_analise}}'}:</strong> Período analisado</li>
          </ul>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Preview em tempo real
        </h3>
        <p className="text-neutral-700">
          Use a função "Visualizar" para ver como o template ficará com dados reais. Teste diferentes configurações até encontrar o layout ideal para cada tipo de relatório.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        7. Templates por área do direito
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">⚖️ Direito Trabalhista</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>Foco em prazos e valores</li>
            <li>Cálculos trabalhistas em destaque</li>
            <li>Atualizações de jurisprudência</li>
            <li>Alertas de prescrição</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">🏠 Direito Civil</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>Cronograma processual detalhado</li>
            <li>Documentos necessários</li>
            <li>Análise de provas</li>
            <li>Estratégias de negociação</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">🚨 Direito Criminal</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>Urgência de prazos destacada</li>
            <li>Status de liberdade/prisão</li>
            <li>Próximas audiências</li>
            <li>Recursos disponíveis</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">💰 Direito Tributário</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>Valores e cálculos em foco</li>
            <li>Datas de vencimento</li>
            <li>Parcelamentos e acordos</li>
            <li>Mudanças legislativas</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        8. Configurações avançadas
      </h2>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Formato de saída:</strong> PDF, HTML ou ambos</li>
        <li><strong>Idioma:</strong> Português BR (padrão) ou outros</li>
        <li><strong>Fuso horário:</strong> Para datas e horários corretos</li>
        <li><strong>Anexos automáticos:</strong> Incluir documentos relevantes</li>
        <li><strong>Assinatura digital:</strong> Certificado digital do advogado</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        9. Teste e validação
      </h2>
      <p className="text-neutral-700 mb-4">
        Antes de aplicar o template:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Gere um exemplo:</strong> Teste com dados reais</li>
        <li><strong>Revise formatação:</strong> Verifique layout em diferentes dispositivos</li>
        <li><strong>Valide variáveis:</strong> Confirme que todos os campos são preenchidos</li>
        <li><strong>Teste impressão:</strong> Veja como fica em papel</li>
        <li><strong>Colete feedback:</strong> Mostre para colegas antes de usar</li>
      </ul>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ⚠️ Cuidados importantes
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li>Mantenha templates simples e profissionais</li>
          <li>Evite cores muito vibrantes que dificultam a leitura</li>
          <li>Teste em dispositivos móveis</li>
          <li>Considere clientes com deficiência visual</li>
          <li>Faça backup dos templates personalizados</li>
        </ul>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        10. Gerenciar biblioteca de templates
      </h2>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Organizar por categoria:</strong> Cliente, área, frequência</li>
        <li><strong>Versionar templates:</strong> Manter histórico de mudanças</li>
        <li><strong>Compartilhar na equipe:</strong> Templates padrão do escritório</li>
        <li><strong>Importar/exportar:</strong> Backup e migração</li>
        <li><strong>Definir padrões:</strong> Template default para novos relatórios</li>
      </ul>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Templates personalizados!
        </h3>
        <p className="text-neutral-700">
          Seus templates estão personalizados e refletem a identidade do seu escritório. Lembre-se de revisar e atualizar periodicamente conforme suas necessidades evoluem.
        </p>
      </div>

      <p className="text-neutral-700">
        Precisa de ajuda para criar templates específicos? Entre em contato em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}