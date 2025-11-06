// ================================================================
// PREVIEW ANALYSIS SERVICE - Análise Rápida com Gemini Flash
// ================================================================
// Gera preview instantâneo do processo usando Gemini Flash (barato e rápido)
// ================================================================

import { getGeminiClient } from '@/lib/gemini-client';
import { ModelTier } from '@/lib/ai-model-types';
import { ICONS } from '@/lib/icons';

// ================================================================
// TYPES
// ================================================================

export interface PreviewSnapshot {
  summary: string;
  parties: string[];
  subject: string;
  object: string; // Objeto jurídico específico (ex: "Agravo de Instrumento contra decisão que negou liminar")
  claimValue: number | null;
  lastMovements: PreviewMovement[];
  generatedAt: string;
  model: string;
  // NOTA: 'confidence' foi removido (não exibido no frontend)
}

export interface PreviewMovement {
  date: string; // ISO 8601
  type: string; // "Sentença", "Audiência", "Despacho", etc.
  description: string;
}

export interface PreviewAnalysisResult {
  success: boolean;
  preview?: PreviewSnapshot;
  error?: string;
  tokensUsed?: number;
  duration?: number;
}

// ================================================================
// CONSTANTS
// ================================================================

// Limitar texto para velocidade (Flash processa rápido até 20KB)
const MAX_TEXT_LENGTH = 20000;

// Timeout para Gemini Flash (30 segundos é suficiente)
const GEMINI_TIMEOUT_MS = 30000;

// ================================================================
// MAIN FUNCTION
// ================================================================

/**
 * Gera preview rápido de um processo usando Gemini Flash
 * Com fallback automático: LITE → BALANCED → PRO
 *
 * @param cleanText - Texto limpo e normalizado do PDF
 * @param caseId - ID do case (para logging)
 * @returns Preview snapshot ou erro
 */
export async function generatePreview(
  cleanText: string,
  caseId: string
): Promise<PreviewAnalysisResult> {
  const startTime = Date.now();

  // Estratégia de fallback: tentar modelos cada vez mais potentes
  const modelStrategy = [
    { tier: ModelTier.LITE, name: 'Flash 8B' },
    { tier: ModelTier.BALANCED, name: 'Flash' },
    { tier: ModelTier.PRO, name: 'Pro' }
  ];

  try {
    console.log(`${ICONS.ROBOT} [Preview] Gerando preview para case ${caseId}...`);

    // ============================================================
    // 1. PREPARAR TEXTO (Limitar para velocidade)
    // ============================================================

    const limitedText = cleanText.substring(0, MAX_TEXT_LENGTH);

    console.log(`${ICONS.INFO} [Preview] Texto limitado: ${limitedText.length} chars (original: ${cleanText.length})`);

    // ============================================================
    // 2. CONSTRUIR PROMPT ESTRITO
    // ============================================================

    const prompt = buildPreviewPrompt(limitedText);

    // ============================================================
    // 3. TENTAR CHAMAR GEMINI COM FALLBACK
    // ============================================================

    const gemini = getGeminiClient();
    let lastError: Error | null = null;

    for (const { tier, name } of modelStrategy) {
      try {
        console.log(`${ICONS.SEARCH} [Preview] Tentativa com Gemini ${name}...`);

        const response = await gemini.generateJsonContent(prompt, {
          model: tier,
          maxTokens: 1500,
          temperature: 0.1,
          timeout: GEMINI_TIMEOUT_MS
        });

        // ============================================================
        // 4. VALIDAR RESPOSTA
        // ============================================================

        if (!response) {
          throw new Error('Gemini retornou resposta vazia');
        }

        const preview: PreviewSnapshot = {
          summary: response.summary || '',
          parties: Array.isArray(response.parties) ? response.parties : [],
          subject: response.subject || '',
          object: response.object || '', // Objeto jurídico específico extraído pelo Gemini
          claimValue: response.claimValue || null,
          lastMovements: Array.isArray(response.lastMovements) ? response.lastMovements : [],
          generatedAt: new Date().toISOString(),
          model: `gemini-2.5-${name.toLowerCase() === 'flash 8b' ? 'flash-8b' : name.toLowerCase().split(' ')[0] === 'flash' ? 'flash' : 'pro'}`
        };

        const duration = Date.now() - startTime;

        console.log(`${ICONS.SUCCESS} [Preview] Preview gerado com ${name} em ${duration}ms`);
        console.log(`${ICONS.INFO} [Preview] Movimentos extraídos: ${preview.lastMovements.length}`);

        return {
          success: true,
          preview,
          tokensUsed: response.usage?.totalTokens || 0,
          duration
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`${ICONS.WARNING} [Preview] Falha com ${name}: ${lastError.message}`);

        // Continuar para próximo modelo se não for a última tentativa
        if (tier === ModelTier.PRO) {
          throw lastError; // Última tentativa falhou
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError || new Error('Todas as tentativas de análise falharam');

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`${ICONS.ERROR} [Preview] Erro ao gerar preview após todas as tentativas:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar preview',
      duration
    };
  }
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Constrói prompt otimizado para Gemini Flash
 * Foco: velocidade + baixo custo + precisão suficiente
 *
 * OTIMIZAÇÃO: Removido campo "confidence" (não exibido no frontend)
 * Isso reduz custo de tokens e torna a resposta mais rápida
 */
function buildPreviewPrompt(text: string): string {
  return `Você é um assistente jurídico especializado em análise de documentos processuais.

Analise o texto jurídico abaixo e extraia APENAS as seguintes informações para exibição em um preview rápido:

1. **summary**: Resumo do processo em 1-2 frases (máx 150 caracteres). Seja conciso e direto.
2. **parties**: Lista de partes principais. Formato: ["Autor: Nome", "Réu: Nome"]
3. **subject**: Classificação/tipo do processo ou recurso (ex: "Execução Fiscal", "Apelação Cível", "Ação Ordinária")
4. **object**: Objeto jurídico específico (O DE QUÊ se trata este documento). Descreva o que está sendo discutido/solicitado, o fundamento jurídico ou a questão principal em disputa. Máx 150 caracteres. Exemplos:
   - "Agravo de Instrumento contra decisão que negou liminar de suspensão de demissão"
   - "Apelação contra sentença de condenação em ação de cobrança de débito"
   - "Execução de Sentença de Indenização por Danos Morais"
5. **claimValue**: Valor da causa em reais como número (ex: 1000000.00) ou null se não houver
6. **lastMovements**: Último andamento mais recente do processo (máximo 1 movimento com: date, type, description)

**REGRAS IMPORTANTES**:
- Retorne APENAS JSON válido, sem texto adicional antes ou depois
- Se alguma informação não for encontrada, use null ou array vazio []
- Datas: formato ISO 8601 (YYYY-MM-DD)
- Descrição: máx 150 caracteres, objetiva
- Não inclua informações de confiança, modelo ou análise de risco
- O campo "object" é OBRIGATÓRIO e deve ser descritivo e jurídico

**FORMATO DE RESPOSTA**:
\`\`\`json
{
  "summary": "Resumo breve do processo...",
  "parties": ["Autor: Nome do Autor", "Réu: Nome do Réu"],
  "subject": "Apelação Cível",
  "object": "Apelação contra sentença que condenou em ação de cobrança de dívida",
  "claimValue": 580907.19,
  "lastMovements": [
    {
      "date": "2025-09-15",
      "type": "Andamento",
      "description": "Descrição breve do último andamento"
    }
  ]
}
\`\`\`

**TEXTO DO PROCESSO**:
${text}

**RESPOSTA (somente JSON)**:`;
}

// ================================================================
// VALIDATION HELPERS
// ================================================================

function isPreviewSnapshot(preview: unknown): preview is PreviewSnapshot {
  if (!preview || typeof preview !== 'object') {
    return false;
  }

  const p = preview as Partial<PreviewSnapshot>;

  // Campos obrigatórios
  if (typeof p.summary !== 'string' || p.summary.trim().length === 0) {
    return false;
  }

  if (!Array.isArray(p.parties) || p.parties.length === 0) {
    return false;
  }

  if (typeof p.subject !== 'string' || p.subject.trim().length === 0) {
    return false;
  }

  if (typeof p.object !== 'string' || p.object.trim().length === 0) {
    return false;
  }

  if (!Array.isArray(p.lastMovements)) {
    return false;
  }

  // Validar estrutura de movimentos (se houver)
  if (p.lastMovements.length > 0) {
    for (const movement of p.lastMovements) {
      const m = movement as Partial<PreviewMovement>;
      if (!m.date || !m.type || !m.description) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Valida se preview snapshot tem estrutura mínima válida
 */
export function validatePreviewSnapshot(preview: unknown): boolean {
  return isPreviewSnapshot(preview);
}

/**
 * Extrai resumo curto do preview para exibição rápida
 */
export function getPreviewSummary(preview: PreviewSnapshot): string {
  const parts = [];

  if (preview.subject) {
    parts.push(preview.subject);
  }

  if (preview.parties.length > 0) {
    parts.push(`Partes: ${preview.parties.length}`);
  }

  if (preview.lastMovements.length > 0) {
    const lastMovement = preview.lastMovements[0];
    parts.push(`Último movimento: ${lastMovement.type} em ${lastMovement.date}`);
  }

  return parts.join(' | ');
}
