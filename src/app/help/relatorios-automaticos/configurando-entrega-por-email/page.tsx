import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function ConfigurandoEntregaEmailPage() {
  return (
    <HelpArticleLayout
      title="Configurando entrega por email"
      category="Relatórios Automáticos"
      readTime="6 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Configure a entrega automática de relatórios por email para manter você, sua equipe e seus clientes sempre atualizados sobre o andamento dos processos.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        1. Configuração inicial do email
      </h2>
      <p className="text-neutral-700 mb-4">
        Primeiro, configure as informações básicas de envio:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Acesse <strong>Configurações → Email e Notificações</strong></li>
        <li>Configure seu <strong>email remetente</strong> (ex: relatorios@seuescritorio.com.br)</li>
        <li>Defina <strong>nome de exibição</strong> (ex: "Escritório Silva Advocacia")</li>
        <li>Configure <strong>email de resposta</strong> para retornos dos clientes</li>
      </ul>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          📧 Configuração profissional
        </h3>
        <p className="text-neutral-700">
          Use sempre emails profissionais do seu domínio (não Gmail pessoal). Isso aumenta a credibilidade e evita que os emails sejam marcados como spam.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        2. Tipos de entrega por email
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">📋 Relatórios agendados</h3>
          <p className="text-blue-700 mb-2">
            <strong>Automático:</strong> Enviados conforme cronograma pré-definido
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1 text-sm">
            <li>Relatórios semanais, quinzenais ou mensais</li>
            <li>Horário fixo de envio</li>
            <li>Lista de destinatários fixa</li>
            <li>Template padronizado</li>
          </ul>
        </div>

        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-green-800 mb-2">⚡ Relatórios instantâneos</h3>
          <p className="text-green-700 mb-2">
            <strong>Manual:</strong> Gerados e enviados sob demanda
          </p>
          <ul className="list-disc list-inside text-green-600 space-y-1 text-sm">
            <li>Após análises importantes</li>
            <li>Atualizações urgentes</li>
            <li>Relatórios personalizados</li>
            <li>Resposta a solicitações específicas</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Personalização do email
      </h2>
      <div className="space-y-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Linha de assunto</h3>
          <p className="text-neutral-700 mb-2">Configure assuntos descritivos e profissionais:</p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Para clientes:</strong> "Relatório semanal - Processo [número] - [data]"</li>
            <li><strong>Para equipe:</strong> "Dashboard jurídico - Semana [data]"</li>
            <li><strong>Para alertas:</strong> "URGENTE: Prazo vencendo - Processo [número]"</li>
            <li><strong>Personalize:</strong> Use variáveis dinâmicas como {'{{cliente_nome}}'}</li>
          </ul>
        </div>

        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">Corpo do email</h3>
          <p className="text-neutral-700 mb-2">Configure a mensagem que acompanha o relatório:</p>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Saudação personalizada:</strong> "Prezado(a) {'{{cliente_nome}}'}"</li>
            <li><strong>Contexto:</strong> Breve explicação sobre o relatório</li>
            <li><strong>Instruções:</strong> Como ler e interpretar o conteúdo</li>
            <li><strong>Próximos passos:</strong> Ações recomendadas</li>
            <li><strong>Contato:</strong> Como entrar em contato para dúvidas</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Configurações de segurança
      </h2>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Criptografia:</strong> Emails enviados com TLS/SSL</li>
        <li><strong>Senha nos PDFs:</strong> Proteger relatórios sensíveis</li>
        <li><strong>Lista de destinatários oculta:</strong> Usar CCO para privacidade</li>
        <li><strong>Autenticação SPF/DKIM:</strong> Evitar marcação como spam</li>
        <li><strong>Links seguros:</strong> URLs com autenticação</li>
      </ul>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ✅ Entrega por email configurada!
        </h3>
        <p className="text-neutral-700">
          Seus relatórios serão entregues automaticamente por email conforme configurado. Monitore as métricas regularmente e ajuste conforme necessário.
        </p>
      </div>

      <p className="text-neutral-700">
        Problemas com entrega de emails? Nossa equipe pode ajudar em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}