// ================================================================
// AI COST CALCULATOR - Token Estimation and Cost Tracking
// ================================================================
// Calculates and tracks AI processing costs across model tiers
// Extracted from ai-model-router.ts for better modularity

import { ModelTier, type ComplexityScore, type ModelCosts } from '../ai-model-types';
import { log } from '@/lib/services/logger';

// ================================================================
// COST CONFIGURATION
// ================================================================

/**
 * Model costs per 1M tokens (USD)
 * Updated: 2025-01-06
 */
export const MODEL_COSTS: Record<ModelTier, { input: number; output: number }> = {
    [ModelTier.LITE]: { input: 0.0375, output: 0.15 },      // Gemini 2.5 Flash Lite
    [ModelTier.BALANCED]: { input: 0.075, output: 0.30 },   // Gemini 2.5 Flash
    [ModelTier.PRO]: { input: 1.25, output: 5.00 }          // Gemini 2.5 Pro
};

// ================================================================
// AI COST CALCULATOR CLASS
// ================================================================

/**
 * AI Cost Calculator
 * Estimates and tracks costs for AI processing across different model tiers
 */
export class AICostCalculator {

    /**
     * Estimates token count for a text
     * Approximation: ~4 characters per token for Portuguese/legal text
     */
    estimateTokens(text: string): number {
        // Portuguese legal text averages ~4 chars per token
        return Math.ceil(text.length / 4);
    }

    /**
     * Calculates estimated processing cost
     */
    calculateCost(inputTokens: number, outputTokens: number, model: ModelTier): ModelCosts {
        const costs = MODEL_COSTS[model];

        // Convert to cost (prices are per 1M tokens)
        const inputCost = (inputTokens / 1_000_000) * costs.input;
        const outputCost = (outputTokens / 1_000_000) * costs.output;

        const result = {
            inputTokenCost: inputCost,
            outputTokenCost: outputCost,
            estimatedCost: inputCost + outputCost
        };

        log.debug({
            msg: `💰 Custo estimado: $${result.estimatedCost.toFixed(6)} (${model})`,
            component: 'aiCostCalculator',
            inputTokens,
            outputTokens,
            model
        });

        return result;
    }

    /**
     * Generates cost savings report comparing actual vs worst-case
     */
    getCostSavingsReport(
        actualModel: ModelTier,
        originalComplexity: ComplexityScore,
        inputTokens: number
    ): {
        actualCost: number;
        worstCaseCost: number;
        savings: number;
        savingsPercentage: number;
    } {
        // Estimate output tokens (typically 10-20% of input for analysis)
        const estimatedOutputTokens = Math.ceil(inputTokens * 0.15);

        // Calculate actual cost
        const actualCosts = this.calculateCost(inputTokens, estimatedOutputTokens, actualModel);

        // Calculate worst-case cost (if we always used PRO)
        const worstCaseCosts = this.calculateCost(inputTokens, estimatedOutputTokens, ModelTier.PRO);

        const savings = worstCaseCosts.estimatedCost - actualCosts.estimatedCost;
        const savingsPercentage = worstCaseCosts.estimatedCost > 0
            ? (savings / worstCaseCosts.estimatedCost) * 100
            : 0;

        const report = {
            actualCost: actualCosts.estimatedCost,
            worstCaseCost: worstCaseCosts.estimatedCost,
            savings,
            savingsPercentage
        };

        log.info({
            msg: `📊 Economia: ${savingsPercentage.toFixed(1)}% ($${savings.toFixed(6)} economizados)`,
            component: 'aiCostCalculator',
            actualModel,
            recommendedTier: originalComplexity.recommendedTier,
            ...report
        });

        return report;
    }

    /**
     * Calculates monthly cost projection based on usage
     */
    projectMonthlyCost(
        dailyDocuments: number,
        averageTokensPerDoc: number,
        modelDistribution: { lite: number; balanced: number; pro: number }
    ): {
        estimatedMonthlyCost: number;
        breakdown: { lite: number; balanced: number; pro: number };
        recommendations: string[];
    } {
        const daysPerMonth = 22; // Business days
        const outputRatio = 0.15;

        const docsPerMonth = dailyDocuments * daysPerMonth;
        const outputTokens = averageTokensPerDoc * outputRatio;

        const liteCost = this.calculateCost(averageTokensPerDoc, outputTokens, ModelTier.LITE).estimatedCost;
        const balancedCost = this.calculateCost(averageTokensPerDoc, outputTokens, ModelTier.BALANCED).estimatedCost;
        const proCost = this.calculateCost(averageTokensPerDoc, outputTokens, ModelTier.PRO).estimatedCost;

        const breakdown = {
            lite: liteCost * docsPerMonth * modelDistribution.lite,
            balanced: balancedCost * docsPerMonth * modelDistribution.balanced,
            pro: proCost * docsPerMonth * modelDistribution.pro
        };

        const estimatedMonthlyCost = breakdown.lite + breakdown.balanced + breakdown.pro;

        const recommendations: string[] = [];

        if (modelDistribution.pro > 0.3) {
            recommendations.push('Alta proporção de uso do modelo Pro. Considere revisar classificação de documentos.');
        }
        if (estimatedMonthlyCost > 100) {
            recommendations.push('Custo mensal elevado. Considere implementar cache agressivo.');
        }
        if (modelDistribution.lite < 0.5) {
            recommendations.push('Baixo uso do modelo Lite. Verifique se documentos simples estão sendo sobre-classificados.');
        }

        return {
            estimatedMonthlyCost,
            breakdown,
            recommendations
        };
    }

    /**
     * Gets cost comparison across all tiers for a given text
     */
    getComparisonForText(text: string): {
        lite: ModelCosts;
        balanced: ModelCosts;
        pro: ModelCosts;
        recommendation: ModelTier;
    } {
        const inputTokens = this.estimateTokens(text);
        const outputTokens = Math.ceil(inputTokens * 0.15);

        return {
            lite: this.calculateCost(inputTokens, outputTokens, ModelTier.LITE),
            balanced: this.calculateCost(inputTokens, outputTokens, ModelTier.BALANCED),
            pro: this.calculateCost(inputTokens, outputTokens, ModelTier.PRO),
            recommendation: inputTokens < 10000 ? ModelTier.LITE :
                inputTokens < 50000 ? ModelTier.BALANCED :
                    ModelTier.PRO
        };
    }
}

// Export singleton instance
export const aiCostCalculator = new AICostCalculator();
