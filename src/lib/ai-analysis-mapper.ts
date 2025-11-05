// ================================================================
// AI Analysis Mapper - Transforma UnifiedProcessSchema → UI Preview
// ================================================================
// Mapeia a estrutura complexa retornada pelo Gemini para o formato
// simples esperado pelo popup de onboarding (FASE 1)

import type { UnifiedProcessSchema } from './ai-model-router';

/**
 * Formato esperado pelo popup de onboarding
 */
export interface OnboardingPreviewData {
  resumo: string;
  partes: string;
  objeto: string;
  valores: string;
  probabilidades: string;
  proximosPassos: string;
  modelUsed: string;
  confidence: number;
  costEstimate: number;
}

/**
 * Mapeia UnifiedProcessSchema para OnboardingPreviewData
 * Extrai apenas as informações essenciais para FASE 1
 */
export function mapAnalysisToPreview(
  analysis: unknown, // UnifiedProcessSchema retornado pelo Gemini
  metadata?: {
    modelUsed?: string;
    confidence?: number;
    costEstimate?: number;
  }
): OnboardingPreviewData {
  // Garantir que temos um objeto válido
  const schema = analysis as Partial<UnifiedProcessSchema> || {};

  const preview: OnboardingPreviewData = {
    // 1. RESUMO - Combina tipo processual + esfera + comarca
    resumo: buildSummary(schema),

    // 2. PARTES - Parte principal vs Parte contrária
    partes: buildParties(schema),

    // 3. OBJETO - Tipo processual + contexto
    objeto: buildObject(schema),

    // 4. VALORES - Valor principal + data de atualização
    valores: buildValues(schema),

    // 5. PROBABILIDADES - Risco classificado por estratégia
    probabilidades: buildProbabilities(schema),

    // 6. PRÓXIMOS PASSOS - Prazos pendentes + recomendações
    proximosPassos: buildNextSteps(schema),

    // Metadados
    modelUsed: metadata?.modelUsed || 'Gemini Flash Lite',
    confidence: metadata?.confidence ?? 0.8,
    costEstimate: metadata?.costEstimate ?? 0
  };

  return preview;
}

/**
 * Constrói resumo executivo
 * Format: "Tipo Processual | Esfera | Comarca"
 */
function buildSummary(schema: Partial<UnifiedProcessSchema>): string {
  const basica = schema.identificacao_basica;
  if (!basica) return 'Análise em processamento...';

  const parts = [
    basica.tipo_processual || 'Processo Judicial',
    basica.esfera || 'Não especificada',
    basica.comarca || 'Comarca não identificada'
  ].filter(Boolean);

  return parts.join(' • ');
}

/**
 * Constrói informação de partes
 * Format: "Parte Principal (Exequente) vs Parte Contrária (Executado)"
 */
function buildParties(schema: Partial<UnifiedProcessSchema>): string {
  const partes = schema.partes_envolvidas;
  if (!partes) return 'Partes não identificadas';

  const principal = partes.parte_principal;
  const contraria = partes.parte_contraria;

  const mainPart = principal
    ? `${principal.nome || 'Parte não nomeada'}${principal.qualificacao ? ` (${principal.qualificacao})` : ''}`
    : 'Parte Principal não identificada';

  const contrapart = contraria
    ? `${contraria.nome || 'Parte não nomeada'}${contraria.qualificacao ? ` (${contraria.qualificacao})` : ''}`
    : 'Parte Contrária não identificada';

  return `${mainPart} vs ${contrapart}`;
}

/**
 * Constrói objeto do litígio
 * Format: "Pedido principal | Causa pedir"
 */
function buildObject(schema: Partial<UnifiedProcessSchema>): string {
  const especializados = schema.campos_especializados;
  const analise = schema.analise_estrategica;

  // Tentar extrair do tipo de ação civil
  if (especializados?.acao_civil) {
    const pedido = especializados.acao_civil.pedido_principal || 'Objeto não especificado';
    const causa = especializados.acao_civil.causa_pedir
      ? ` — ${especializados.acao_civil.causa_pedir}`
      : '';
    return `${pedido}${causa}`;
  }

  // Fallback para tese jurídica central (se disponível)
  if (analise?.tese_juridica_central) {
    return analise.tese_juridica_central;
  }

  // Fallback para tipo processual
  if (schema.identificacao_basica?.tipo_processual) {
    return schema.identificacao_basica.tipo_processual;
  }

  return 'Objeto do litígio não identificado';
}

/**
 * Constrói informação de valores
 * Format: "R$ X.XXX,XX | Atualizado em DD/MM/YYYY"
 */
function buildValues(schema: Partial<UnifiedProcessSchema>): string {
  const valores = schema.valores_financeiros;
  if (!valores) return 'Valores não identificados';

  const valor = valores.valor_principal || valores.valor_total;
  if (!valor) return 'Valor não especificado';

  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);

  const dataAtualizacao = valores.valor_atualizado_em
    ? ` | Atualizado em ${valores.valor_atualizado_em}`
    : '';

  return `${formatted}${dataAtualizacao}`;
}

/**
 * Constrói informação de probabilidades
 * Format: "Risco: [Classificação] | [Justificativa]"
 */
function buildProbabilities(schema: Partial<UnifiedProcessSchema>): string {
  const analise = schema.analise_estrategica;
  if (!analise) return 'Análise de probabilidade não disponível';

  const risco = analise.risco_classificacao || 'Não classificado';
  const justificativa = analise.risco_justificativa
    ? ` — ${analise.risco_justificativa}`
    : '';

  // Converter risco em probabilidade aproximada
  const riscoProbabilidade = {
    'Provável': '75%+ de sucesso',
    'Possível': '50-75% de sucesso',
    'Remoto': '<50% de sucesso'
  } as Record<string, string>;

  const probabilidade = riscoProbabilidade[risco] || `Risco: ${risco}`;

  return `${probabilidade}${justificativa}`;
}

/**
 * Constrói próximos passos
 * Format: "• [Descrição] em [Data] | • [Recomendação]"
 */
function buildNextSteps(schema: Partial<UnifiedProcessSchema>): string {
  const situacao = schema.situacao_processual;
  const analise = schema.analise_estrategica;

  const passos: string[] = [];

  // 1. Prazos pendentes (se houver)
  if (situacao?.prazos_pendentes && situacao.prazos_pendentes.length > 0) {
    const prazos = situacao.prazos_pendentes
      .slice(0, 2) // Pegar até 2 prazos
      .map(p => `Prazo: ${p.descricao} (${p.data_limite})`)
      .join(' | ');
    passos.push(prazos);
  }

  // 2. Recomendações estratégicas (se houver)
  if (analise?.recomendacoes_estrategicas && analise.recomendacoes_estrategicas.length > 0) {
    const recomendacao = analise.recomendacoes_estrategicas[0];
    passos.push(`Recomendação: ${recomendacao}`);
  }

  // 3. Último andamento (se não houver prazos ou recomendações E houver resumo do andamento)
  if (passos.length === 0 && situacao?.ultimo_andamento?.resumo) {
    const ultimo = situacao.ultimo_andamento;
    passos.push(`Último andamento: ${ultimo.resumo}`);
  }

  // Fallback - Se não houver nenhuma informação
  if (passos.length === 0) {
    return 'Aguardando atualização de próximos passos...';
  }

  return passos.join(' | ');
}

/**
 * Extrai apenas os campos principais para logging
 */
export function extractCoreInfo(schema: Partial<UnifiedProcessSchema>): {
  processNumber?: string;
  processType?: string;
  mainParty?: string;
  oppositeParty?: string;
  value?: number;
  riskLevel?: string;
} {
  return {
    processNumber: schema.identificacao_basica?.numero_processo || undefined,
    processType: schema.identificacao_basica?.tipo_processual || undefined,
    mainParty: schema.partes_envolvidas?.parte_principal?.nome || undefined,
    oppositeParty: schema.partes_envolvidas?.parte_contraria?.nome || undefined,
    value: schema.valores_financeiros?.valor_principal || undefined,
    riskLevel: schema.analise_estrategica?.risco_classificacao || undefined
  };
}
