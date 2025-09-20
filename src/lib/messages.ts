// ================================================================
// SISTEMA DE MENSAGENS CONSISTENTE - JustoAI
// ================================================================
// Mensagens padronizadas em português para profissionais jurídicos

// ================================================================
// MENSAGENS DE QUOTA E CRÉDITOS
// ================================================================

export const QUOTA_MESSAGES = {
  // Status de quota
  quota_ok: 'Dentro do limite mensal',
  quota_soft_warning: 'Você já usou 80% da sua cota mensal',
  quota_hard_blocked: 'Limite mensal atingido',

  // Descrições detalhadas
  quota_usage: (used: number, limit: number) =>
    `Você já usou ${used} de ${limit} relatórios neste mês`,

  quota_remaining: (remaining: number) =>
    remaining === 1 ? '1 relatório restante' : `${remaining} relatórios restantes`,

  // Avisos de threshold
  soft_warning_title: 'Atenção: Quota próxima do limite',
  soft_warning_description: 'Você já utilizou 80% da sua cota mensal de relatórios. Considere fazer upgrade do plano ou comprar créditos extras.',

  hard_blocked_title: 'Limite mensal atingido',
  hard_blocked_description: 'Você atingiu o limite de relatórios do seu plano. Para continuar gerando relatórios, faça upgrade ou compre créditos extras.',

  // Ações disponíveis
  action_upgrade: 'Fazer Upgrade do Plano',
  action_buy_credits: 'Comprar Créditos Extras',
  action_schedule_next_month: 'Agendar para Próximo Mês',
  action_schedule_night: 'Agendar para Próxima Madrugada (50% desconto)',
} as const;

export const CREDIT_MESSAGES = {
  // Status de créditos
  credits_sufficient: 'Créditos suficientes',
  credits_low: 'Créditos baixos',
  credits_insufficient: 'Créditos insuficientes',

  // Descrições
  credits_balance: (balance: number) =>
    balance === 1 ? '1 crédito disponível' : `${balance} créditos disponíveis`,

  credits_needed: (needed: number) =>
    needed === 1 ? '1 crédito necessário' : `${needed} créditos necessários`,

  // Avisos
  low_credits_title: 'Saldo de créditos baixo',
  low_credits_description: 'Você tem poucos créditos restantes. Considere comprar mais para continuar usando análises FULL.',

  insufficient_credits_title: 'Créditos insuficientes',
  insufficient_credits_description: (needed: number, available: number) =>
    `Esta análise requer ${needed} créditos, mas você tem apenas ${available} disponíveis.`,
} as const;

// ================================================================
// MENSAGENS DE RELATÓRIOS
// ================================================================

export const REPORT_MESSAGES = {
  // Tipos de tom
  tone_client: {
    label: 'Cliente',
    description: 'Linguagem acessível para apresentação ao cliente'
  },
  tone_board: {
    label: 'Diretoria',
    description: 'Formato executivo para tomada de decisões'
  },
  tone_internal: {
    label: 'Uso Interno',
    description: 'Detalhes técnicos para equipe jurídica'
  },

  // Agendamento
  schedule_immediate: 'Gerar Agora',
  schedule_night: 'Agendar para Madrugada',
  schedule_next_month: 'Agendar para Próximo Mês',

  // Descontos
  night_discount: '50% de desconto nos créditos',
  night_discount_description: 'Relatórios agendados para madrugada (02h às 06h) têm 50% de desconto no consumo de créditos.',

  // Status de geração
  generating: 'Gerando relatório...',
  scheduled: 'Relatório agendado',
  completed: 'Relatório concluído',
  failed: 'Erro na geração',
} as const;

// ================================================================
// MENSAGENS DE UPLOAD E ANÁLISE
// ================================================================

export const UPLOAD_MESSAGES = {
  // Tipos de documento
  single_pdf: {
    title: 'PDF Individual',
    description: 'Um único documento PDF para análise'
  },
  full_analysis: {
    title: 'Processo Completo',
    description: 'Múltiplos documentos de um processo'
  },
  excel_batch: {
    title: 'Importação em Lote',
    description: 'Planilha Excel com vários processos',
    recommendation: 'Recomendado para escritórios'
  },

  // Instruções
  drag_drop_pdf: 'Arraste PDFs aqui ou clique para selecionar',
  drag_drop_excel: 'Arraste planilhas Excel aqui ou clique para selecionar',
  formats_pdf: 'Apenas arquivos PDF são aceitos',
  formats_excel: 'Formatos aceitos: .xlsx, .xls - máximo 10MB',

  // Status de processamento
  uploading: 'Enviando',
  analyzing: 'Analisando',
  completed: 'Concluído',
  error: 'Erro',

  // Análise com IA
  ai_analysis_title: 'Análise Inteligente pronta para começar!',
  ai_analysis_description: 'Nossa IA identificará todos os campos relevantes e fará a extração completa para você. Não precisa configurar nada, é só enviar os arquivos.',

  // Cache
  cache_available: 'Cache disponível - resultado instantâneo',
  cache_not_available: 'Nenhuma análise em cache - será processada nova análise',
  cache_fresh: 'Primeira análise deste processo levará alguns segundos',
  cache_outdated: 'Documentos foram alterados desde a última análise',
} as const;

// ================================================================
// MENSAGENS DE PROCESSO E TELEMETRIA
// ================================================================

export const PROCESS_MESSAGES = {
  // Detecção de duplicatas
  duplicate_detected_title: 'Processo Existente Identificado!',
  duplicate_detected_description: (processTitle: string) =>
    `Identificamos que este documento pertence ao processo ${processTitle}. Deseja anexá-lo a este processo existente?`,

  action_attach_existing: 'Sim, anexar ao processo existente',
  action_create_new: 'Não, criar novo processo',

  // Monitoramento
  monitoring_active: 'Monitoramento ativo',
  monitoring_paused: 'Monitoramento pausado',

  // Status de movimentação
  movement_detected: 'Nova movimentação detectada',
  deadline_approaching: 'Prazo se aproximando',
  deadline_overdue: 'Prazo vencido',
} as const;

export const TELEMETRY_MESSAGES = {
  // Uso mensal
  monthly_usage: 'Uso Mensal',
  processes_monitored: 'Processos Monitorados',
  reports_generated: 'Relatórios Gerados',
  credits_consumed: 'Créditos Consumidos',
  api_calls: 'Consultas Externas',

  // Descrições detalhadas
  processes_description: 'Processos monitorados ativamente',
  reports_description: 'Relatórios gerados este mês',
  credits_description: 'Créditos de análise consumidos',
  api_description: 'Consultas realizadas automaticamente para monitoramento',

  // Alertas operacionais
  high_usage_alert: 'Uso elevado detectado',
  cost_warning: 'Custo estimado próximo do limite',
  api_limit_warning: 'Limite de consultas externas próximo',

  // Renovação
  renews_in: (days: number) =>
    days === 1 ? 'Renova em 1 dia' : `Renova em ${days} dias`,
} as const;

// ================================================================
// MENSAGENS DE ERRO E VALIDAÇÃO
// ================================================================

export const ERROR_MESSAGES = {
  // Erros gerais
  network_error: 'Erro de conexão. Verifique sua internet e tente novamente.',
  server_error: 'Erro interno do servidor. Nossa equipe foi notificada.',
  permission_denied: 'Você não tem permissão para realizar esta ação.',

  // Erros de upload
  file_too_large: 'Arquivo muito grande. Tamanho máximo: 10MB',
  invalid_format: 'Formato de arquivo inválido',
  upload_failed: 'Falha no upload. Tente novamente.',

  // Erros de quota/créditos
  quota_exceeded: 'Limite mensal de relatórios atingido',
  insufficient_credits: 'Créditos insuficientes para realizar esta operação',

  // Erros de processamento
  analysis_failed: 'Falha na análise do documento',
  report_generation_failed: 'Erro na geração do relatório',
  cache_error: 'Erro ao acessar cache de análises',

  // Validação de Excel
  excel_missing_columns: 'Planilha deve conter as colunas obrigatórias',
  excel_invalid_process_number: 'Número do processo inválido',
  excel_empty_client: 'Campo cliente não pode estar vazio',
  excel_invalid_date: 'Data em formato inválido',
} as const;

// ================================================================
// MENSAGENS DE SUCESSO
// ================================================================

export const SUCCESS_MESSAGES = {
  // Upload e análise
  upload_success: 'Arquivo enviado com sucesso',
  analysis_completed: 'Análise concluída com sucesso',
  batch_import_success: (count: number) =>
    `Importação concluída: ${count} processos criados com sucesso`,

  // Relatórios
  report_generated: 'Relatório gerado com sucesso',
  report_scheduled: 'Relatório agendado com sucesso',

  // Créditos e planos
  credits_purchased: 'Créditos adquiridos com sucesso',
  plan_upgraded: 'Plano atualizado com sucesso',

  // Configurações
  settings_saved: 'Configurações salvas com sucesso',
  notification_sent: 'Notificação enviada com sucesso',
} as const;

// ================================================================
// MENSAGENS DE AJUDA E ORIENTAÇÃO
// ================================================================

export const HELP_MESSAGES = {
  // Orientações gerais
  how_it_works_title: 'Como funciona a análise',
  how_it_works_description: 'Nossa IA analisa automaticamente seus documentos jurídicos e extrai informações relevantes:',
  how_it_works_steps: [
    'Identifica o tipo de documento (petição, sentença, contrato, etc.)',
    'Extrai dados estruturados (partes, datas, valores, prazos)',
    'Gera resumo executivo do conteúdo',
    'Identifica riscos e recomendações',
    'Organiza tudo no caso selecionado'
  ],

  // Dicas contextuais
  tip_night_scheduling: 'Use o agendamento noturno para relatórios com 50% de desconto nos créditos!',
  tip_batch_import: 'Para múltiplos processos, use a importação em lote via Excel',
  tip_cache_benefit: 'Análises repetidas usam cache para resultado instantâneo',

  // Recomendações
  recommendation_upgrade: 'Considere comprar créditos extras para evitar interrupções no serviço.',
  recommendation_monitor: 'Configure monitoramento automático para novos processos',
  recommendation_review: 'Revisar processos com erro na aba "Erros"',
  recommendation_assign: 'Definir responsáveis para cada processo importado',
} as const;

// ================================================================
// FUNÇÃO UTILITÁRIA PARA FORMATAÇÃO
// ================================================================

export function formatMessage(template: string, ...args: any[]): string {
  return template.replace(/{(\d+)}/g, (match, index) => {
    return args[index] !== undefined ? String(args[index]) : match;
  });
}

// Função para obter mensagem com fallback
export function getMessage(
  category: keyof typeof QUOTA_MESSAGES | keyof typeof CREDIT_MESSAGES | keyof typeof REPORT_MESSAGES,
  key: string,
  fallback = 'Mensagem não encontrada'
): string {
  const messages = {
    quota: QUOTA_MESSAGES,
    credit: CREDIT_MESSAGES,
    report: REPORT_MESSAGES,
    upload: UPLOAD_MESSAGES,
    process: PROCESS_MESSAGES,
    telemetry: TELEMETRY_MESSAGES,
    error: ERROR_MESSAGES,
    success: SUCCESS_MESSAGES,
    help: HELP_MESSAGES,
  };

  // @ts-ignore - Type checking is complex here but it's safe
  return messages[category]?.[key] || fallback;
}

// Validação de tom de relatório
export function isValidReportTone(tone: string): tone is 'client' | 'board' | 'internal' {
  return ['client', 'board', 'internal'].includes(tone);
}

// Formatação de números para português brasileiro
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num);
}

// Formatação de percentual
export function formatPercentage(num: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num / 100);
}

// Formatação de valores monetários
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}