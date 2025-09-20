import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function IntegracoesFuturasPage() {
  return (
    <HelpArticleLayout
      title="Integrações futuras"
      category="Integrações"
      readTime="5 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        A JustoAI está em constante evolução. Conheça as integrações que estamos desenvolvendo e como elas irão facilitar ainda mais seu fluxo de trabalho jurídico.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Roadmap de integrações
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg text-green-800">📧 Integração via Email</h3>
            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm">Em desenvolvimento</span>
          </div>
          <p className="text-green-700 mb-3">
            <strong>Previsão:</strong> 2º trimestre 2024
          </p>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li>Envie documentos diretamente por email para análise automática</li>
            <li>Endereço personalizado para cada cliente (cliente@seuescritorio.justoai.com.br)</li>
            <li>Processamento automático de anexos em PDF</li>
            <li>Notificações de conclusão via email</li>
            <li>Integração com sistemas de email existentes</li>
          </ul>
        </div>

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg text-blue-800">📱 API REST Completa</h3>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">3º trimestre 2024</span>
          </div>
          <p className="text-blue-700 mb-3">
            <strong>Para desenvolvedores:</strong> Integração programática com qualquer sistema
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li>Endpoints para upload e análise de documentos</li>
            <li>Webhooks para notificações em tempo real</li>
            <li>Consulta de resultados e métricas via API</li>
            <li>Autenticação segura com tokens JWT</li>
            <li>Documentação completa e SDKs em principais linguagens</li>
          </ul>
        </div>

        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg text-purple-800">💾 Conectores para Sistemas Jurídicos</h3>
            <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm">4º trimestre 2024</span>
          </div>
          <p className="text-purple-700 mb-3">
            <strong>Integração direta:</strong> Conexão nativa com sistemas populares
          </p>
          <ul className="list-disc list-inside text-purple-600 space-y-1 text-sm">
            <li>Sincronização automática de processos</li>
            <li>Importação incremental de novos documentos</li>
            <li>Atualização bidirecional de status</li>
            <li>Configuração via interface gráfica</li>
            <li>Suporte técnico especializado por sistema</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Integrações com tribunais
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-orange-800 mb-3">⚖️ Consulta automatizada de andamentos</h3>
          <p className="text-orange-700 mb-3">
            <strong>Objetivo:</strong> Automatizar consulta de andamentos processuais
          </p>
          <ul className="list-disc list-inside text-orange-600 space-y-2 text-sm">
            <li><strong>Tribunais de Justiça Estaduais:</strong> Consulta via APIs oficiais quando disponíveis</li>
            <li><strong>Tribunal Regional do Trabalho:</strong> Acompanhamento automático de decisões</li>
            <li><strong>Tribunais Superiores:</strong> STF, STJ, STM, TST, TSE</li>
            <li><strong>Juizados Especiais:</strong> Integração com sistemas locais</li>
            <li><strong>Notificações inteligentes:</strong> Alertas sobre mudanças importantes</li>
          </ul>
        </div>
      </div>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          🗳️ Influencie nosso roadmap!
        </h3>
        <p className="text-neutral-700 mb-3">
          Suas necessidades específicas podem acelerar o desenvolvimento de certas integrações:
        </p>
        <ul className="text-neutral-700 space-y-1 text-sm">
          <li>• <strong>Vote em integrações:</strong> Acesse nossa pesquisa de prioridades</li>
          <li>• <strong>Sugira sistemas:</strong> Conte quais ferramentas você usa</li>
          <li>• <strong>Programa beta:</strong> Teste integrações antes do lançamento</li>
          <li>• <strong>Parceria técnica:</strong> Para grandes escritórios com necessidades específicas</li>
        </ul>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Cronograma de lançamentos
      </h2>
      <div className="space-y-3 mb-6">
        <div className="flex items-center space-x-4 p-3 border border-neutral-200 rounded-lg">
          <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">Q2</div>
          <div>
            <h4 className="font-semibold text-neutral-800">2024 - Integrações básicas</h4>
            <p className="text-neutral-600 text-sm">Email, webhooks, API básica</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 p-3 border border-neutral-200 rounded-lg">
          <div className="bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">Q3</div>
          <div>
            <h4 className="font-semibold text-neutral-800">2024 - Produtividade</h4>
            <p className="text-neutral-600 text-sm">Google Workspace, Office 365, calendários</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 p-3 border border-neutral-200 rounded-lg">
          <div className="bg-purple-500 text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">Q4</div>
          <div>
            <h4 className="font-semibold text-neutral-800">2024 - Sistemas jurídicos</h4>
            <p className="text-neutral-600 text-sm">Conectores para principais sistemas do mercado</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 p-3 border border-neutral-200 rounded-lg">
          <div className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">Q1</div>
          <div>
            <h4 className="font-semibold text-neutral-800">2025 - Tribunais e BI</h4>
            <p className="text-neutral-600 text-sm">Consultas automatizadas, dashboards avançados</p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Fique por dentro!
        </h3>
        <p className="text-neutral-700">
          Acompanhe nosso blog e newsletter para receber atualizações sobre novas integrações. Seu feedback é essencial para priorizarmos desenvolvimentos que realmente agreguem valor ao seu trabalho.
        </p>
      </div>

      <p className="text-neutral-700">
        Tem uma integração específica em mente? Conte para nós em <strong>sugestoes@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}