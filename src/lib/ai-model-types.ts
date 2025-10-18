// ================================================================
// AI MODEL TYPES - Shared types across AI modules (no circular deps)
// ================================================================
// Pure type definitions for Model Tier and interfaces used by both
// ai-model-router and gemini-client

export enum ModelTier {
  LITE = 'gemini-1.5-flash-8b',   // Mais barato (95% economia)
  BALANCED = 'gemini-1.5-flash',  // Equilibrado
  PRO = 'gemini-1.5-pro'          // Maior qualidade
}

export interface ComplexityScore {
  totalScore: number;
  factors: {
    documentType: number;
    textLength: number;
    legalComplexity: number;
    structuralComplexity: number;
    filesizeComplexity: number;
  };
  recommendedTier: ModelTier;
  confidence: number;
  documentType?: string;
}

export interface ProcessingConfig {
  model: ModelTier;
  maxTokens: number;
  temperature: number;
  promptTemplate: string;
  fallbackModel?: ModelTier;
}

export interface ModelCosts {
  inputTokenCost: number;
  outputTokenCost: number;
  estimatedCost: number;
}

export interface GeminiConfig {
  apiKey: string;
  model: ModelTier;
  maxTokens: number;
  temperature: number;
  topP?: number;
  topK?: number;
}

export interface GeminiResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: string;
}

export interface GeminiError {
  error: string;
  code: number;
  details?: string;
  retryable: boolean;
}
