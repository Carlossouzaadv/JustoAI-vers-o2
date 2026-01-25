/**
 * ================================================================
 * ANALYSIS PARSER - Serialize/Deserialize aiAnalysis Field
 * ================================================================
 *
 * Since aiAnalysis is now stored as TEXT (STRING) in Postgres,
 * we need type-safe helpers to convert between STRING ↔ JSON
 *
 * PADRÃO-OURO: Type-safe parsing with proper error handling
 */

import type { AIAnalysisData } from '@/lib/types/json-fields';

/**
 * Parse aiAnalysis from STRING to JSON object
 * Handles both valid JSON and string-wrapped JSON
 *
 * @param aiAnalysisString - The raw aiAnalysis STRING from database
 * @returns Parsed AIAnalysisData object or null if invalid
 */
export function parseAiAnalysis(aiAnalysisString: unknown): AIAnalysisData | null {
  // Handle null/undefined
  if (aiAnalysisString === null || aiAnalysisString === undefined) {
    return null;
  }

  // Must be a string
  if (typeof aiAnalysisString !== 'string') {
    console.warn('[AnalysisParser] aiAnalysis is not a string:', typeof aiAnalysisString);
    return null;
  }

  // Empty string
  if (aiAnalysisString.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(aiAnalysisString);

    // Validate it's an object
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('[AnalysisParser] Parsed aiAnalysis is not an object');
      return null;
    }

    return parsed as AIAnalysisData;
  } catch (error) {
    console.warn('[AnalysisParser] Failed to parse aiAnalysis JSON:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Safely get analysis field with fallback
 *
 * @param aiAnalysisString - Raw STRING from database
 * @param defaultValue - Fallback value if parsing fails
 * @returns Parsed object or default
 */
export function getAnalysisData(
  aiAnalysisString: unknown,
  defaultValue: AIAnalysisData = {}
): AIAnalysisData {
  const parsed = parseAiAnalysis(aiAnalysisString);
  return parsed ?? defaultValue;
}

/**
 * Type guard: Check if value is valid AIAnalysisData
 */
export function isValidAiAnalysisData(data: unknown): data is AIAnalysisData {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data)
  );
}

/**
 * Extract specific field from aiAnalysis with type safety
 *
 * @param aiAnalysisString - Raw STRING from database
 * @param fieldName - Field to extract
 * @returns Field value or null
 */
export function extractAnalysisField<K extends keyof AIAnalysisData>(
  aiAnalysisString: unknown,
  fieldName: K
): AIAnalysisData[K] | null {
  const parsed = parseAiAnalysis(aiAnalysisString);
  if (!parsed) return null;

  return parsed[fieldName] ?? null;
}
