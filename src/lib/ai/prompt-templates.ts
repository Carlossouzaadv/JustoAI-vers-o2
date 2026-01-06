// ================================================================
// AI PROMPT TEMPLATES - Optimized Prompts for Model Tiers
// ================================================================
// Provides optimized prompt templates for different AI model tiers
// Extracted from ai-model-router.ts for better maintainability

import { ModelTier } from '../ai-model-types';
import { getUnifiedSchemaForPrompt } from './unified-schema';

// ================================================================
// BASE PROMPTS BY TIER
// ================================================================

/**
 * Gets optimized prompt for the given model tier
 */
export function getOptimizedPrompt(tier: ModelTier, _documentType: string): string {
    const schemaJson = getUnifiedSchemaForPrompt();

    switch (tier) {
        case ModelTier.LITE:
            return `Você é um assistente jurídico de IA focado em extração de dados essenciais. Analise o documento anexo.

INSTRUÇÕES:
1. Extraia apenas as informações mais críticas para uma rápida identificação.
2. Se uma informação não for encontrada, use o valor null.
3. Retorne a resposta em formato JSON, seguindo estritamente o schema fornecido.

FOCO DA EXTRAÇÃO:
Preencha APENAS as seções A (identificacao_basica), B (partes_envolvidas) e C (valores_financeiros) do schema. Ignore as outras seções complexas.

SCHEMA DE SAÍDA:
${schemaJson}`;

        case ModelTier.BALANCED:
            return `Você é um assistente jurídico especializado em análise completa de documentos legais. Analise o documento anexo.

INSTRUÇÕES:
1. Realize uma análise completa dos dados do processo.
2. Faça uma avaliação de risco preliminar baseada nos fatos apresentados.
3. Se uma informação não for encontrada, use o valor null.
4. Retorne a resposta em formato JSON, seguindo estritamente o schema fornecido.

FOCO DA EXTRAÇÃO:
Preencha as seções A, B, C, D (campos_especializados), E (situacao_processual) e F (analise_estrategica - risco_classificacao e risco_justificativa devem ser concisos, 1-2 frases). Ignore a seção G (documentos_relacionados).

SCHEMA DE SAÍDA:
${schemaJson}`;

        case ModelTier.PRO:
            return `Você é um analista jurídico sênior de IA, especializado em análises detalhadas e estratégicas de processos judiciais brasileiros. Analise o documento anexo.

INSTRUÇÕES AVANÇADAS:
1. Conduza uma análise jurídica abrangente e profunda.
2. Extraia todos os dados factuais com a máxima precisão.
3. Na seção "analise_estrategica", forneça insights qualitativos, identificando a tese central, oportunidades, riscos e recomendações práticas.
4. Se uma informação não for encontrada, use o valor null.
5. Retorne a resposta em formato JSON, seguindo estritamente o schema fornecido.

FOCO DA EXTRAÇÃO:
Preencha TODAS as seções do schema com o maior detalhamento possível. Use sua expertise para análises estratégicas fundamentadas.

SCHEMA DE SAÍDA:
${schemaJson}`;

        default:
            return 'Você é um assistente jurídico especializado em análise de documentos.';
    }
}

// ================================================================
// MULTI-FRONT ANALYSIS PROMPTS
// ================================================================

/**
 * Gets specialized prompt for multi-front analysis of complex processes
 */
export function getMultiFrontAnalysisPrompt(tier: ModelTier, _processData: unknown): string {
    const basePrompt = getOptimizedPrompt(tier, 'legal');

    return `${basePrompt}

=== ANÁLISE MULTI-FRENTES PARA PROCESSOS COMPLEXOS ===

OBJETIVO ESPECÍFICO:
Processos judiciais complexos frequentemente têm múltiplas questões acontecendo simultaneamente.
Sua tarefa é identificar e organizar as diferentes frentes de discussão ativas no processo.

INSTRUÇÕES ESPECIAIS PARA MULTI-FRENTES:
1. Identifique todas as frentes de discussão paralelas (ex: penhora, suspensão, recursos, execução, mérito)
2. Para cada frente identificada, determine:
   - Status atual específico (ex: aguardando decisão, suspenso, em andamento)
   - Próximos passos esperados para essa frente
   - Prazos correndo (especificando qual parte e qual ação)
   - Última movimentação relevante para essa frente

ESTRUTURA ADICIONAL NO JSON:
Inclua uma seção "frentes_discussao" no JSON de resposta:

"frentes_discussao": [
  {
    "nome_frente": "string",
    "status_atual": "string",
    "proximos_passos": "string",
    "prazos_correndo": {
      "existe_prazo": boolean,
      "parte_responsavel": "string | null",
      "acao_prazo": "string | null",
      "data_limite": "string | null"
    },
    "ultima_movimentacao": {
      "data": "string",
      "tipo": "string",
      "resumo": "string"
    },
    "nivel_prioridade": "Alta | Média | Baixa"
  }
],
"resumo_executivo_frentes": "string"

DETECÇÃO AUTOMÁTICA DE FRENTES COMUNS:
- Mérito principal (discussão de fundo)
- Execução/cumprimento de sentença
- Recursos (apelação, agravo, embargos)
- Medidas cautelares
- Questões processuais (competência, nulidades)
- Penhora e avaliação de bens
- Suspensão/sobrestamento
- Perícias e provas

PRIORIZAÇÃO:
- Alta: Prazos fatais correndo, decisões iminentes
- Média: Andamentos em curso sem urgência
- Baixa: Questões pendentes sem prazo definido`;
}

// ================================================================
// AUDIENCE-SPECIFIC INSTRUCTIONS
// ================================================================

/**
 * Gets audience-specific instructions
 */
export function getAudienceInstructions(audience: 'Cliente' | 'Diretoria' | 'Uso Interno'): string {
    switch (audience) {
        case 'Cliente':
            return `PÚBLICO-ALVO: CLIENTE
LINGUAGEM: Acessível e didática, evitando excesso de jargão jurídico
FOCO: Impactos práticos, próximos passos, custos e benefícios
DETALHAMENTO: Médio, explicando conceitos quando necessário
TERMINOLOGIA: Use termos como "processo", "recurso", "decisão judicial" em linguagem clara`;

        case 'Diretoria':
            return `PÚBLICO-ALVO: DIRETORIA EXECUTIVA
LINGUAGEM: Corporativa e objetiva, focada em resultados
FOCO: KPIs, riscos empresariais, impactos financeiros, decisões estratégicas
DETALHAMENTO: Alto nível, priorizando métricas e indicadores
TERMINOLOGIA: Use linguagem executiva, comparando com indicadores de performance`;

        case 'Uso Interno':
            return `PÚBLICO-ALVO: EQUIPE JURÍDICA INTERNA
LINGUAGEM: Técnica e precisa, pode usar jargão jurídico específico
FOCO: Aspectos técnicos, fundamentação legal, estratégias processuais
DETALHAMENTO: Completo, incluindo nuances e aspectos técnicos
TERMINOLOGIA: Use terminologia jurídica técnica sem simplificações`;

        default:
            return 'PÚBLICO-ALVO: GENÉRICO\nLINGUAGEM: Equilibrada entre técnica e acessível';
    }
}

/**
 * Gets report type-specific instructions
 */
export function getReportTypeInstructions(reportType: 'COMPLETO' | 'NOVIDADES'): string {
    switch (reportType) {
        case 'COMPLETO':
            return `TIPO DE RELATÓRIO: ANÁLISE COMPLETA
ESCOPO: Análise abrangente de todos os aspectos dos processos
CONTEÚDO: Status geral, histórico relevante, análise de risco, projeções
ESTRUTURA: Visão 360° de cada frente de discussão
PROFUNDIDADE: Máxima, incluindo contexto histórico e projeções futuras`;

        case 'NOVIDADES':
            return `TIPO DE RELATÓRIO: DELTA/NOVIDADES
ESCOPO: Foque APENAS nas mudanças desde o último relatório
CONTEÚDO: Novas movimentações, alterações de status, prazos que surgiram/venceram
ESTRUTURA: Organize por "o que mudou" em cada frente
PROFUNDIDADE: Focada no delta, comparando com situação anterior
INSTRUÇÃO ESPECIAL: Se não houve movimentação significativa em uma frente, mencione brevemente e passe para a próxima`;

        default:
            return 'TIPO: Relatório padrão com análise equilibrada';
    }
}

/**
 * Gets question type-specific instructions
 */
export function getQuestionTypeInstructions(
    questionType: 'status' | 'proximos_passos' | 'prazos' | 'analise_completa'
): string {
    switch (questionType) {
        case 'status':
            return `FOCO: STATUS ATUAL
Responda de forma direta qual é a situação atual do processo.
Priorize: fase processual, último andamento, pendências imediatas.`;

        case 'proximos_passos':
            return `FOCO: PRÓXIMOS PASSOS
Liste as ações esperadas em ordem cronológica.
Para cada passo: responsável, prazo (se houver), consequência de não cumprimento.`;

        case 'prazos':
            return `FOCO: PRAZOS
Liste TODOS os prazos identificados: judiciais, contratuais, legais.
Para cada prazo: data limite, parte responsável, ação requerida, consequência do vencimento.
Ordene por urgência (prazos mais próximos primeiro).`;

        case 'analise_completa':
        default:
            return `FOCO: ANÁLISE COMPLETA
Realize análise abrangente incluindo:
- Status atual detalhado
- Frentes de discussão ativas
- Próximos passos esperados
- Prazos correndo
- Análise de risco
- Recomendações estratégicas`;
    }
}

// ================================================================
// EXECUTIVE REPORT PROMPT
// ================================================================

/**
 * Gets prompt for executive reports organized by fronts
 */
export function getExecutiveReportPrompt(
    tier: ModelTier,
    _processesData: unknown[],
    audience: 'Cliente' | 'Diretoria' | 'Uso Interno' = 'Cliente',
    reportType: 'COMPLETO' | 'NOVIDADES' = 'COMPLETO'
): string {
    const audienceInstructions = getAudienceInstructions(audience);
    const reportTypeInstructions = getReportTypeInstructions(reportType);

    return `Você é um analista jurídico especializado em relatórios executivos para ${audience.toLowerCase()}.

${audienceInstructions}

${reportTypeInstructions}

=== ESTRUTURA OBRIGATÓRIA DO RELATÓRIO ===

1. RESUMO EXECUTIVO GERAL
   - Panorama geral dos processos
   - Principais destaques do período
   - Alertas de alta prioridade

2. ANÁLISE POR FRENTES DE DISCUSSÃO
   2.1 FRENTE: EXECUÇÃO E COBRANÇA
   2.2 FRENTE: RECURSOS E REVISÕES
   2.3 FRENTE: QUESTÕES PROCESSUAIS
   2.4 FRENTE: MEDIDAS CAUTELARES

3. CALENDÁRIO DE AÇÕES PRIORITÁRIAS

4. INDICADORES QUANTITATIVOS

FORMATO DE SAÍDA: JSON estruturado`;
}

// ================================================================
// SPECIFIC SITUATION PROMPT
// ================================================================

/**
 * Gets prompt for specific situation analysis
 */
export function getSpecificSituationPrompt(
    tier: ModelTier,
    processNumber: string,
    situation: string,
    questionType: 'status' | 'proximos_passos' | 'prazos' | 'analise_completa' = 'analise_completa'
): string {
    const basePrompt = getOptimizedPrompt(tier, 'legal');
    const questionInstructions = getQuestionTypeInstructions(questionType);

    return `${basePrompt}

=== ANÁLISE DE SITUAÇÃO ESPECÍFICA ===

PROCESSO: ${processNumber}
SITUAÇÃO ATUAL: ${situation}

${questionInstructions}

INSTRUÇÕES ESPECÍFICAS:
1. Analise a situação descrita no contexto do processo judicial
2. Identifique as frentes de discussão relevantes para esta situação
3. Forneça recomendações práticas e acionáveis
4. Destaque riscos e oportunidades identificados`;
}
