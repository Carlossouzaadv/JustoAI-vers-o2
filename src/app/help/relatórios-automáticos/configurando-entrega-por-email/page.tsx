/* eslint-disable react/no-unescaped-entities */
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

        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-purple-800 mb-2">🚨 Alertas automáticos</h3>
          <p className="text-purple-700 mb-2">
            <strong>Baseado em eventos:</strong> Disparados por situações específicas
          </p>
          <ul className="list-disc list-inside text-purple-600 space-y-1 text-sm">
            <li>Prazos próximos ao vencimento</li>
            <li>Atualizações críticas em processos</li>
            <li>Novas decisões judiciais</li>
            <li>Mudanças de status importantes</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        3. Configurando destinatários
      </h2>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">👨‍💼 Destinatários internos</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>Advogado responsável:</strong> Sempre incluído</li>
            <li><strong>Sócios:</strong> Para supervisão</li>
            <li><strong>Assistentes:</strong> Para acompanhamento</li>
            <li><strong>Estagiários:</strong> Para aprendizado</li>
            <li><strong>Departamento específico:</strong> Por área de atuação</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-3">👥 Destinatários externos</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-2 text-sm">
            <li><strong>Cliente principal:</strong> Pessoa física ou responsável</li>
            <li><strong>Departamento jurídico:</strong> Em empresas</li>
            <li><strong>Consultores externos:</strong> Outros profissionais</li>
            <li><strong>Familiares:</strong> Com autorização expressa</li>
            <li><strong>Cópias de cortesia:</strong> Stakeholders relevantes</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        4. Personalização do email
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
        5. Configurações de entrega
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-primary-700">Horários de envio</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Horário comercial:</strong> 8h às 18h (recomendado)</li>
            <li><strong>Início da manhã:</strong> 8h-9h (para planejamento)</li>
            <li><strong>Final do dia:</strong> 17h-18h (para fechamento)</li>
            <li><strong>Fora do horário:</strong> Apenas para urgências</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-primary-700">Frequência</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Diária:</strong> Para casos muito urgentes</li>
            <li><strong>Semanal:</strong> Padrão recomendado</li>
            <li><strong>Quinzenal:</strong> Para acompanhamento regular</li>
            <li><strong>Mensal:</strong> Para visão de longo prazo</li>
          </ul>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica: Segmentação inteligente
        </h3>
        <p className="text-neutral-700">
          Configure diferentes frequências para diferentes tipos de destinatário. Clientes podem receber relatórios semanais, enquanto a equipe interna recebe atualizações diárias.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        6. Formato e anexos
      </h2>
      <div className="space-y-3 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Formato do relatório</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>PDF anexo:</strong> Relatório completo em PDF (recomendado)</li>
            <li><strong>HTML no email:</strong> Conteúdo direto no corpo do email</li>
            <li><strong>Link para visualização:</strong> Acesso via navegador</li>
            <li><strong>Múltiplos formatos:</strong> PDF + HTML para flexibilidade</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">Anexos adicionais</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li><strong>Documentos relevantes:</strong> Petições, sentenças recentes</li>
            <li><strong>Planilhas de dados:</strong> Excel com informações estruturadas</li>
            <li><strong>Calendário:</strong> ICS com próximos compromissos</li>
            <li><strong>Material educativo:</strong> Guias e explicações</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        7. Configurações de segurança
      </h2>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Criptografia:</strong> Emails enviados com TLS/SSL</li>
        <li><strong>Senha nos PDFs:</strong> Proteger relatórios sensíveis</li>
        <li><strong>Lista de destinatários oculta:</strong> Usar CCO para privacidade</li>
        <li><strong>Autenticação SPF/DKIM:</strong> Evitar marcação como spam</li>
        <li><strong>Links seguros:</strong> URLs com autenticação</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        8. Monitoramento e métricas
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">📊 Métricas de entrega</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>Taxa de entrega bem-sucedida</li>
            <li>Emails retornados (bounce)</li>
            <li>Marcados como spam</li>
            <li>Tempo médio de entrega</li>
          </ul>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-primary-700 mb-2">👁️ Métricas de engajamento</h3>
          <ul className="list-disc list-inside text-neutral-600 space-y-1 text-sm">
            <li>Taxa de abertura dos emails</li>
            <li>Cliques em links</li>
            <li>Downloads de anexos</li>
            <li>Respostas recebidas</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        9. Solução de problemas comuns
      </h2>
      <div className="space-y-3 mb-6">
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-yellow-800 mb-2">📥 Emails na caixa de spam</h3>
          <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
            <li>Configure SPF e DKIM do domínio</li>
            <li>Use email profissional como remetente</li>
            <li>Evite palavras como "urgente" em excesso</li>
            <li>Solicite que clientes adicionem à lista de contatos</li>
          </ul>
        </div>
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-red-800 mb-2">❌ Falhas na entrega</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
            <li>Verifique se emails dos destinatários estão corretos</li>
            <li>Confirme que anexos não excedem limite de tamanho</li>
            <li>Teste com diferentes provedores de email</li>
            <li>Configure retry automático para falhas temporárias</li>
          </ul>
        </div>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        10. Melhores práticas
      </h2>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Teste antes de ativar:</strong> Envie para si mesmo primeiro</li>
        <li><strong>Mantenha listas atualizadas:</strong> Remova emails inválidos</li>
        <li><strong>Personalize por cliente:</strong> Adapte frequência e conteúdo</li>
        <li><strong>Monitore engagement:</strong> Ajuste com base no feedback</li>
        <li><strong>Tenha plano B:</strong> Alternativas quando email falha</li>
        <li><strong>Documente configurações:</strong> Para facilitar manutenção</li>
      </ul>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          ⚠️ Considerações legais
        </h3>
        <ul className="text-neutral-700 space-y-2">
          <li>Sempre tenha autorização expressa para envio de emails</li>
          <li>Respeite a LGPD ao compartilhar dados de processos</li>
          <li>Ofereça opção de descadastro fácil</li>
          <li>Mantenha logs de envio para auditoria</li>
        </ul>
      </div>

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