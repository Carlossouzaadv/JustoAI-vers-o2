// ================================================================
// AI COMPLEXITY ANALYZER - Document Classification and Scoring
// ================================================================
// Analyzes legal documents to determine complexity and recommend AI model tier
// Extracted from ai-model-router.ts for better modularity

import { ModelTier, type ComplexityScore } from '../ai-model-types';
import { log } from '@/lib/services/logger';

/**
 * Document pattern definition for type detection
 */
interface DocumentPattern {
    pattern: RegExp;
    type: string;
    weight: number;
}

/**
 * Document type detection result
 */
export interface DocumentTypeResult {
    type: string;
    confidence: number;
}

// ================================================================
// PATTERN DEFINITIONS
// ================================================================

/**
 * ANÁLISE RÁPIDA (Flash 8B) - Documentos de baixa complexidade
 */
const RAPID_ANALYSIS_PATTERNS: DocumentPattern[] = [
    { pattern: /juntada|juntou-se|juntei|anexo|documento anexo/i, type: 'JUNTADA', weight: 3 },
    { pattern: /despacho.*mero expediente|certidão|intimação|publicação/i, type: 'DESPACHO_EXPEDIENTE', weight: 3 },
    { pattern: /carga dos autos|conclusão|vista|remessa/i, type: 'MOVIMENTACAO_CARTORIO', weight: 2 },
    { pattern: /ar.*juntado|comprovante.*entrega|aviso.*recebimento/i, type: 'COMPROVANTE_INTIMACAO', weight: 2 }
];

/**
 * ANÁLISE PADRÃO (Flash) - Documentos do dia a dia
 */
const STANDARD_ANALYSIS_PATTERNS: DocumentPattern[] = [
    { pattern: /petição inicial|exordial|inicial/i, type: 'PETICAO_INICIAL', weight: 4 },
    { pattern: /contestação|resposta|defesa/i, type: 'CONTESTACAO', weight: 4 },
    { pattern: /tréplica|impugnação.*contestação/i, type: 'TREPLICA', weight: 3 },
    { pattern: /agravo.*instrumento|agravo.*retido/i, type: 'AGRAVO', weight: 3 },
    { pattern: /apelação|recurso.*apelação/i, type: 'APELACAO', weight: 3 },
    { pattern: /embargos.*declaração|embargos declaratórios/i, type: 'EMBARGOS_DECLARACAO', weight: 2 },
    { pattern: /mandado.*segurança|impetrante|impetrado/i, type: 'MANDADO_SEGURANCA', weight: 3 },
    { pattern: /ação.*civil.*pública|ministério.*público.*autor/i, type: 'ACAO_CIVIL_PUBLICA', weight: 4 }
];

/**
 * ANÁLISE COMPLETA (Pro) - Documentos de alta complexidade
 */
const COMPLEX_ANALYSIS_PATTERNS: DocumentPattern[] = [
    { pattern: /sentença|julgo.*procedente|julgo.*improcedente|dispositivo/i, type: 'SENTENCA', weight: 8 },
    { pattern: /acórdão|acordam.*desembargadores|tribunal.*justiça.*decide/i, type: 'ACORDAO', weight: 8 },
    { pattern: /supremo.*tribunal|stf|recurso.*extraordinário/i, type: 'DECISAO_STF', weight: 10 },
    { pattern: /superior.*tribunal.*justiça|stj|recurso.*especial/i, type: 'DECISAO_STJ', weight: 8 },
    { pattern: /constitucional.*inconstitucionalidade|controle.*constitucionalidade/i, type: 'CONTROLE_CONSTITUCIONALIDADE', weight: 10 },
    { pattern: /precedente.*vinculante|súmula.*vinculante|repercussão.*geral/i, type: 'PRECEDENTE_VINCULANTE', weight: 9 }
];

// ================================================================
// COMPLEXITY SCORING MAPS
// ================================================================

/** ANÁLISE RÁPIDA (Flash 8B) - 0-10 pontos */
const RAPID_ANALYSIS_SCORES: Record<string, number> = {
    'JUNTADA': 2,
    'DESPACHO_EXPEDIENTE': 3,
    'MOVIMENTACAO_CARTORIO': 1,
    'COMPROVANTE_INTIMACAO': 1
};

/** ANÁLISE PADRÃO (Flash) - 10-25 pontos */
const STANDARD_ANALYSIS_SCORES: Record<string, number> = {
    'PETICAO_INICIAL': 15,
    'CONTESTACAO': 18,
    'TREPLICA': 12,
    'AGRAVO': 20,
    'APELACAO': 22,
    'EMBARGOS_DECLARACAO': 10,
    'MANDADO_SEGURANCA': 15,
    'ACAO_CIVIL_PUBLICA': 25
};

/** ANÁLISE COMPLETA (Pro) - 30-50 pontos */
const COMPLEX_ANALYSIS_SCORES: Record<string, number> = {
    'SENTENCA': 35,
    'ACORDAO': 40,
    'DECISAO_STF': 50,
    'DECISAO_STJ': 45,
    'CONTROLE_CONSTITUCIONALIDADE': 50,
    'PRECEDENTE_VINCULANTE': 48
};

// ================================================================
// COMPLEXITY ANALYZER CLASS
// ================================================================

/**
 * AI Complexity Analyzer
 * Analyzes legal documents to determine processing complexity and recommend model tier
 */
export class ComplexityAnalyzer {

    /**
     * Analyzes document complexity and recommends optimal AI model tier
     * 
     * RULES BY TYPE:
     * 📍 ANÁLISE RÁPIDA (Flash 8B): Juntadas, despachos de expediente, movimentações
     * 📍 ANÁLISE PADRÃO (Flash): Petições, contestações, recursos comuns
     * 📍 ANÁLISE COMPLETA (Pro): Sentenças, acórdãos, decisões superiores
     */
    analyzeComplexity(text: string, fileSizeMB: number = 0): ComplexityScore {
        log.info({ msg: '🧮 Analisando complexidade do documento...', component: 'complexityAnalyzer' });

        // 1. DETECT DOCUMENT TYPE
        const documentType = this.detectDocumentType(text);
        log.info({
            msg: `📄 Tipo detectado: ${documentType.type} (confiança: ${Math.round(documentType.confidence * 100)}%)`,
            component: 'complexityAnalyzer'
        });

        // 2. APPLY TYPE-SPECIFIC RULES
        const documentTypeScore = this.getDocumentTypeComplexityScore(documentType);

        // 3. CALCULATE TRADITIONAL FACTORS
        const factors = {
            documentType: documentTypeScore,
            textLength: this.calculateTextLengthScore(text),
            legalComplexity: this.calculateLegalComplexityScore(text),
            structuralComplexity: this.calculateStructuralComplexityScore(text),
            filesizeComplexity: this.calculateFilesizeScore(fileSizeMB)
        };

        const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);

        // 4. ROUTING LOGIC
        // ANÁLISE RÁPIDA (Flash 8B): 0-35 pontos
        // ANÁLISE PADRÃO (Flash): 36-75 pontos
        // ANÁLISE COMPLETA (Pro): >75 pontos

        let recommendedTier: ModelTier;
        let confidence: number;

        if (totalScore <= 35) {
            recommendedTier = ModelTier.LITE;
            confidence = 0.9;
        } else if (totalScore <= 75) {
            recommendedTier = ModelTier.BALANCED;
            confidence = 0.85;
        } else {
            recommendedTier = ModelTier.PRO;
            confidence = 0.95;
        }

        log.info({
            msg: `📊 Complexidade: ${totalScore} pontos (${documentType.type}) → Modelo: ${recommendedTier}`,
            component: 'complexityAnalyzer'
        });

        return {
            totalScore,
            factors,
            recommendedTier,
            confidence,
            documentType: documentType.type
        };
    }

    /**
     * Detects legal document type based on patterns and keywords
     */
    detectDocumentType(text: string): DocumentTypeResult {
        const lowerText = text.toLowerCase();

        // Calculate scores for each category
        const scores = {
            rapid: this.calculatePatternScore(lowerText, RAPID_ANALYSIS_PATTERNS),
            standard: this.calculatePatternScore(lowerText, STANDARD_ANALYSIS_PATTERNS),
            complex: this.calculatePatternScore(lowerText, COMPLEX_ANALYSIS_PATTERNS)
        };

        const maxScore = Math.max(...Object.values(scores));

        if (maxScore === 0) {
            return { type: 'DOCUMENTO_GENERICO', confidence: 0.5 };
        }

        // Find specific pattern with highest score
        const allPatterns = [...RAPID_ANALYSIS_PATTERNS, ...STANDARD_ANALYSIS_PATTERNS, ...COMPLEX_ANALYSIS_PATTERNS];
        let bestMatch = { type: 'DOCUMENTO_GENERICO', score: 0 };

        for (const pattern of allPatterns) {
            if (pattern.pattern.test(lowerText)) {
                if (pattern.weight > bestMatch.score) {
                    bestMatch = { type: pattern.type, score: pattern.weight };
                }
            }
        }

        const confidence = Math.min(bestMatch.score / 10, 1);

        return {
            type: bestMatch.type,
            confidence
        };
    }

    /**
     * Calculates score for specific patterns
     */
    private calculatePatternScore(text: string, patterns: DocumentPattern[]): number {
        let score = 0;
        for (const pattern of patterns) {
            if (pattern.pattern.test(text)) {
                score += pattern.weight;
            }
        }
        return score;
    }

    /**
     * Gets complexity score based on document type
     */
    private getDocumentTypeComplexityScore(documentType: DocumentTypeResult): number {
        const { type, confidence } = documentType;

        let baseScore = 5; // Default for unclassified documents

        if (type in RAPID_ANALYSIS_SCORES) {
            baseScore = RAPID_ANALYSIS_SCORES[type];
        } else if (type in STANDARD_ANALYSIS_SCORES) {
            baseScore = STANDARD_ANALYSIS_SCORES[type];
        } else if (type in COMPLEX_ANALYSIS_SCORES) {
            baseScore = COMPLEX_ANALYSIS_SCORES[type];
        }

        // Apply confidence factor
        const finalScore = Math.round(baseScore * confidence);

        log.info({
            msg: `📄 Tipo: ${type} → Base: ${baseScore}, Confiança: ${Math.round(confidence * 100)}%, Final: ${finalScore}`,
            component: 'complexityAnalyzer'
        });

        return finalScore;
    }

    /**
     * Calculates score based on text length - adjusted for large documents
     */
    private calculateTextLengthScore(text: string): number {
        const length = text.length;

        if (length < 10000) return 3;      // Short texts
        if (length < 50000) return 8;      // Medium texts
        if (length < 150000) return 15;    // Long texts (300-400 pages standard)
        if (length < 300000) return 25;    // Very long texts
        return 35;                         // Extremely long texts
    }

    /**
     * Calculates legal complexity based on keywords
     */
    private calculateLegalComplexityScore(text: string): number {
        const lowerText = text.toLowerCase();
        let score = 0;

        // High complexity terms
        const highComplexityTerms = [
            'constitucional', 'inconstitucionalidade', 'supremo tribunal',
            'recurso extraordinário', 'repercussão geral', 'precedente vinculante',
            'modulação de efeitos', 'coisa julgada', 'devido processo legal'
        ];

        // Medium complexity terms
        const mediumComplexityTerms = [
            'apelação', 'agravo', 'embargos', 'mandado de segurança',
            'ação civil pública', 'execução fiscal', 'usucapião'
        ];

        // Count high complexity terms
        for (const term of highComplexityTerms) {
            const matches = (lowerText.match(new RegExp(term, 'g')) || []).length;
            score += matches * 3;
        }

        // Count medium complexity terms
        for (const term of mediumComplexityTerms) {
            const matches = (lowerText.match(new RegExp(term, 'g')) || []).length;
            score += matches * 1.5;
        }

        // Detect frequent legal citations
        const legalCitations = (lowerText.match(/(?:art\.|artigo)\s*\d+/g) || []).length;
        score += Math.min(legalCitations * 0.5, 10);

        return Math.min(score, 25);
    }

    /**
     * Calculates structural complexity of document
     */
    private calculateStructuralComplexityScore(text: string): number {
        let score = 0;

        const structures = {
            lists: (text.match(/^\s*[\d\w]\.\s/gm) || []).length,
            tables: (text.match(/\|[\s\S]*?\|/g) || []).length,
            sections: (text.match(/^\s*[IVX]+\.\s/gm) || []).length,
            subsections: (text.match(/^\s*\d+\.\d+\s/gm) || []).length
        };

        score += Math.min(structures.lists * 0.5, 5);
        score += Math.min(structures.tables * 2, 8);
        score += Math.min(structures.sections * 1, 5);
        score += Math.min(structures.subsections * 0.5, 3);

        return Math.min(score, 20);
    }

    /**
     * Calculates complexity based on file size - adjusted for 50MB average
     */
    private calculateFilesizeScore(fileSizeMB: number): number {
        if (fileSizeMB < 10) return 0;     // Small files
        if (fileSizeMB < 30) return 5;     // Medium files
        if (fileSizeMB < 60) return 10;    // Standard files (50MB average)
        if (fileSizeMB < 100) return 20;   // Large files
        return 30;                         // Very large files
    }
}

// Export singleton instance
export const complexityAnalyzer = new ComplexityAnalyzer();
