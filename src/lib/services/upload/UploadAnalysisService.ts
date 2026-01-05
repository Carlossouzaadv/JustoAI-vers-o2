
import { AIModelRouter } from '@/lib/ai-model-router';
import { AnalysisCacheManager } from '@/lib/analysis-cache';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

export interface AnalysisResult {
    aiAnalysisResult: Record<string, unknown> | null;
    cacheResult: {
        hit: boolean;
        key?: string;
    };
    analysisKey: string;
    modelVersion: string;
}

export class UploadAnalysisService {
    private cacheManager: AnalysisCacheManager;
    private analysisModelVersion = 'gemini-2.5-flash';
    private promptSignature = 'legal-document-analysis-v2';

    constructor(cacheManager: AnalysisCacheManager) {
        this.cacheManager = cacheManager;
    }

    /**
     * Performs Phase 1 Analysis (Check Cache -> Lock -> Gemini -> Save Cache)
     */
    public async performInitialAnalysis(
        textSha: string,
        cleanText: string,
        workspaceId: string,
        fileSizeMB: number
    ): Promise<AnalysisResult> {
        const analysisKeyBase = textSha + '_' + this.analysisModelVersion;

        // 1. Check Cache
        // NOTE: We check cache but original logic had strict "IsValidCacheData" check
        const cacheResult = await this.cacheManager.checkAnalysisCache(
            [textSha],
            this.analysisModelVersion,
            this.promptSignature
        );

        if (cacheResult.hit && this.isValidCacheData(cacheResult.data)) {
            log.info({ msg: `${ICONS.SUCCESS} Cache válido encontrado`, component: 'UploadAnalysisService' });
            return {
                aiAnalysisResult: cacheResult.data || null,
                cacheResult: { hit: true, key: cacheResult.key },
                analysisKey: cacheResult.key,
                modelVersion: this.analysisModelVersion
            };
        }

        if (cacheResult.hit) {
            log.warn({ msg: `${ICONS.WARNING} Cache encontrado mas inválido - re-executando`, component: 'UploadAnalysisService' });
        }

        // 2. Acquire Lock
        const lockResult = await this.cacheManager.acquireLock(analysisKeyBase);

        // If locked by another worker with valid TTL, we might want to throw or return null
        // But original logic throws 429 if locked.
        if (!lockResult.acquired && lockResult.lockKey && lockResult.ttl > 10) {
            // Should be handled by controller to return 429
            throw new Error(`DOCUMENT_LOCKED:${lockResult.ttl}`);
        }

        const lockKey = lockResult.lockKey;
        let aiAnalysisResult: Record<string, unknown> | null = null;

        try {
            // 3. Run Gemini Phase 1
            log.info({ msg: `${ICONS.ROBOT} [Upload] Iniciando analyzePhase1...`, component: 'UploadAnalysisService' });

            const aiRouter = new AIModelRouter();
            const analysisRaw: unknown = await aiRouter.analyzePhase1(cleanText, fileSizeMB, workspaceId);

            if (this.isAIAnalysisResult(analysisRaw)) {
                aiAnalysisResult = analysisRaw;
            } else {
                log.warn({ msg: `${ICONS.WARNING} [Upload] Análise retornou estrutura inválida`, component: 'UploadAnalysisService' });
                aiAnalysisResult = null;
            }

            // 4. Save to Cache
            if (aiAnalysisResult) {
                await this.cacheManager.saveAnalysisCache(
                    [textSha],
                    this.analysisModelVersion,
                    this.promptSignature,
                    aiAnalysisResult,
                    undefined,
                    workspaceId
                );
            }

        } catch (error) {
            logError(error instanceof Error ? error : new Error(String(error)), `${ICONS.ERROR} Erro na análise IA`, { component: 'UploadAnalysisService' });
            // Continue without analysis
        } finally {
            if (lockKey) {
                await this.cacheManager.releaseLock(lockKey);
            }
        }

        return {
            aiAnalysisResult,
            cacheResult: { hit: false, key: analysisKeyBase }, // Not a cache hit since we computed it
            analysisKey: analysisKeyBase, // Or generated key from cache manager
            modelVersion: this.analysisModelVersion
        };
    }

    // Helper Type Guards
    private isValidCacheData(data: unknown): data is Record<string, unknown> {
        if (!data || typeof data !== 'object') return false;
        const hasLastMovements = 'lastMovements' in data && Array.isArray((data as Record<string, unknown>).lastMovements);
        const hasSummary = 'summary' in data && (data as Record<string, unknown>).summary !== undefined;
        const hasParties = 'parties' in data && (data as Record<string, unknown>).parties !== undefined;
        return hasLastMovements && hasSummary && hasParties;
    }

    private isAIAnalysisResult(data: unknown): data is Record<string, unknown> {
        return !!data && typeof data === 'object';
    }
}
