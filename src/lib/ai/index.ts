// ================================================================
// AI MODULE - Barrel Export
// ================================================================
// Central export point for all AI-related modules
// Provides clean import paths: import { ... } from '@/lib/ai'

// Types and enums
export { ModelTier } from '../ai-model-types';
export type {
    ComplexityScore,
    ProcessingConfig,
    ModelCosts,
    GeminiConfig,
    GeminiResponse,
    GeminiError
} from '../ai-model-types';

// Complexity Analyzer
export { ComplexityAnalyzer, complexityAnalyzer } from './complexity-analyzer';
export { CachedComplexityAnalyzer, cachedComplexityAnalyzer } from './cached-complexity-analyzer';
export type { DocumentTypeResult } from './complexity-analyzer';

// Cost Calculator
export { AICostCalculator, aiCostCalculator, MODEL_COSTS } from './cost-calculator';

// Unified Schema
export type {
    UnifiedProcessSchema,
    UnifiedProcessSchemaWithFronts,
    FrenteDiscussao
} from './unified-schema';
export { getUnifiedSchemaForPrompt } from './unified-schema';

// Prompt Templates
export {
    getOptimizedPrompt,
    getMultiFrontAnalysisPrompt,
    getAudienceInstructions,
    getReportTypeInstructions,
    getQuestionTypeInstructions,
    getExecutiveReportPrompt,
    getSpecificSituationPrompt
} from './prompt-templates';

// Main Router (legacy compatibility)
// The AIModelRouter class is kept for backward compatibility
// New code should import from specific modules above
export { AIModelRouter } from '../ai-model-router';
