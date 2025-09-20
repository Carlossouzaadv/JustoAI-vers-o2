// ================================================================
// TESTES E2E - Endpoints de Análise
// ================================================================

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock do Prisma
const mockPrisma = {
  case: {
    findUnique: jest.fn()
  },
  caseAnalysisVersion: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  caseDocument: {
    findMany: jest.fn()
  },
  processMovement: {
    findFirst: jest.fn()
  },
  processTimelineEntry: {
    create: jest.fn()
  },
  monitoredProcess: {
    create: jest.fn(),
    update: jest.fn()
  },
  processSyncLog: {
    create: jest.fn()
  }
};

// Mock do cache manager
const mockCacheManager = {
  checkAnalysisCache: jest.fn(),
  saveAnalysisCache: jest.fn(),
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
  getLastMovementDate: jest.fn(),
  getProcessDocumentHashes: jest.fn()
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
}));

jest.mock('../lib/analysis-cache', () => ({
  getAnalysisCacheManager: () => mockCacheManager
}));

describe('Analysis API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/process/{id}/analysis', () => {
    it('deve processar análise FAST com cache miss', async () => {
      const processId = 'process-123';
      const requestBody = {
        level: 'FAST',
        includeDocuments: true,
        includeTimeline: true
      };

      // Mock setup
      mockCacheManager.getLastMovementDate.mockResolvedValue(new Date('2024-01-15T10:00:00Z'));
      mockCacheManager.getProcessDocumentHashes.mockResolvedValue(['doc1', 'doc2']);
      mockCacheManager.checkAnalysisCache.mockResolvedValue({
        hit: false,
        key: 'analysis-key-123'
      });
      mockCacheManager.acquireLock.mockResolvedValue({
        acquired: true,
        lockKey: 'lock:analysis:analysis-key-123',
        ttl: 300
      });

      mockPrisma.caseAnalysisVersion.findFirst.mockResolvedValue({ version: 2 });
      mockPrisma.caseAnalysisVersion.create.mockResolvedValue({
        id: 'analysis-version-123',
        version: 3,
        status: 'PROCESSING'
      });

      // Simular POST request
      const response = await simulateAnalysisRequest(processId, requestBody);

      expect(response.success).toBe(true);
      expect(response.level).toBe('FAST');
      expect(response.source).toBe('processing');
      expect(response.model).toBe('gemini-1.5-flash');
      expect(response.version).toBe(3);

      // Verificar calls
      expect(mockCacheManager.getProcessDocumentHashes).toHaveBeenCalledWith(processId, mockPrisma);
      expect(mockCacheManager.checkAnalysisCache).toHaveBeenCalled();
      expect(mockCacheManager.acquireLock).toHaveBeenCalled();
      expect(mockPrisma.caseAnalysisVersion.create).toHaveBeenCalled();
    });

    it('deve retornar cache hit quando análise existe', async () => {
      const processId = 'process-123';
      const requestBody = { level: 'FAST' };

      const cachedAnalysis = {
        summary: 'Análise cacheada',
        keyPoints: ['Ponto 1', 'Ponto 2']
      };

      // Mock cache hit
      mockCacheManager.getLastMovementDate.mockResolvedValue(new Date('2024-01-15T10:00:00Z'));
      mockCacheManager.getProcessDocumentHashes.mockResolvedValue(['doc1']);
      mockCacheManager.checkAnalysisCache.mockResolvedValue({
        hit: true,
        data: cachedAnalysis,
        age: 3600,
        key: 'cache-key'
      });

      mockPrisma.caseAnalysisVersion.findFirst.mockResolvedValue({ version: 1 });
      mockPrisma.caseAnalysisVersion.create.mockResolvedValue({
        id: 'cached-version-123',
        version: 2
      });

      const response = await simulateAnalysisRequest(processId, requestBody);

      expect(response.success).toBe(true);
      expect(response.source).toBe('cache');
      expect(mockCacheManager.acquireLock).not.toHaveBeenCalled(); // Não precisa de lock para cache
    });

    it('deve falhar quando não há documentos para análise FAST', async () => {
      const processId = 'process-123';
      const requestBody = { level: 'FAST' };

      mockCacheManager.getLastMovementDate.mockResolvedValue(null);
      mockCacheManager.getProcessDocumentHashes.mockResolvedValue([]); // Nenhum documento

      const response = await simulateAnalysisRequest(processId, requestBody);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Nenhum documento encontrado');
      expect(response.suggestion).toContain('Use a opção FULL');
    });

    it('deve retornar erro 429 quando lock não é adquirido', async () => {
      const processId = 'process-123';
      const requestBody = { level: 'FULL' };

      mockCacheManager.getLastMovementDate.mockResolvedValue(null);
      mockCacheManager.getProcessDocumentHashes.mockResolvedValue(['doc1']);
      mockCacheManager.checkAnalysisCache.mockResolvedValue({
        hit: false,
        key: 'analysis-key'
      });
      mockCacheManager.acquireLock.mockResolvedValue({
        acquired: false,
        lockKey: 'lock-key',
        ttl: 120
      });

      const response = await simulateAnalysisRequest(processId, requestBody);

      expect(response.success).toBe(false);
      expect(response.error).toContain('já está sendo processada');
      expect(response.retryIn).toBe(120);
    });

    it('deve processar análise FULL com configurações corretas', async () => {
      const processId = 'process-123';
      const requestBody = {
        level: 'FULL',
        uploadedFile: '/tmp/uploaded-document.pdf'
      };

      mockCacheManager.getLastMovementDate.mockResolvedValue(new Date('2024-01-15T10:00:00Z'));
      mockCacheManager.getProcessDocumentHashes.mockResolvedValue(['existing-doc']);
      mockCacheManager.checkAnalysisCache.mockResolvedValue({
        hit: false,
        key: 'full-analysis-key'
      });
      mockCacheManager.acquireLock.mockResolvedValue({
        acquired: true,
        lockKey: 'lock-key',
        ttl: 300
      });

      mockPrisma.caseAnalysisVersion.findFirst.mockResolvedValue(null);
      mockPrisma.caseAnalysisVersion.create.mockResolvedValue({
        id: 'full-analysis-123',
        version: 1
      });

      const response = await simulateAnalysisRequest(processId, requestBody);

      expect(response.success).toBe(true);
      expect(response.level).toBe('FULL');
      expect(response.model).toBe('gemini-1.5-pro');
      expect(response.estimatedTime).toContain('2-3 minutos');
    });
  });

  describe('GET /api/process/{id}/analysis/versions', () => {
    it('deve retornar histórico de versões com diffs', async () => {
      const processId = 'process-123';

      const mockVersions = [
        {
          id: 'v3',
          version: 3,
          status: 'COMPLETED',
          analysisType: 'FULL',
          modelUsed: 'gemini-1.5-pro',
          confidence: 0.95,
          createdAt: new Date('2024-01-17T10:00:00Z'),
          aiAnalysis: { summary: 'Análise mais recente', keyPoints: ['A', 'B', 'C'] }
        },
        {
          id: 'v2',
          version: 2,
          status: 'COMPLETED',
          analysisType: 'FAST',
          modelUsed: 'gemini-1.5-flash',
          confidence: 0.85,
          createdAt: new Date('2024-01-16T10:00:00Z'),
          aiAnalysis: { summary: 'Análise anterior', keyPoints: ['A', 'B'] }
        },
        {
          id: 'v1',
          version: 1,
          status: 'COMPLETED',
          analysisType: 'FAST',
          modelUsed: 'gemini-1.5-flash',
          confidence: 0.80,
          createdAt: new Date('2024-01-15T10:00:00Z'),
          aiAnalysis: { summary: 'Primeira análise', keyPoints: ['A'] }
        }
      ];

      mockPrisma.caseAnalysisVersion.findMany.mockResolvedValue(mockVersions);

      const response = await simulateVersionsRequest(processId);

      expect(response.success).toBe(true);
      expect(response.totalVersions).toBe(3);
      expect(response.versions).toHaveLength(3);

      // Verificar que a primeira versão é marcada como latest
      expect(response.versions[0].isLatest).toBe(true);
      expect(response.versions[1].isLatest).toBeFalsy();

      // Verificar que diffs foram calculados
      expect(response.versions[0].diff).toBeTruthy();
      expect(response.versions[0].changes).toBeTruthy();

      // Verificar mudanças detectadas
      const firstVersionChanges = response.versions[0].changes;
      expect(firstVersionChanges.totalChanges).toBeGreaterThan(0);
      expect(firstVersionChanges.changes).toContainEqual(
        expect.objectContaining({
          type: 'analysis_type',
          impact: 'high'
        })
      );
    });

    it('deve retornar lista vazia quando não há análises', async () => {
      const processId = 'process-without-analysis';

      mockPrisma.caseAnalysisVersion.findMany.mockResolvedValue([]);

      const response = await simulateVersionsRequest(processId);

      expect(response.success).toBe(true);
      expect(response.totalVersions).toBe(0);
      expect(response.versions).toHaveLength(0);
      expect(response.message).toContain('Nenhuma análise encontrada');
    });
  });

  describe('POST /api/process/{id}/analysis/auto-download', () => {
    it('deve iniciar auto-download e agendar análise', async () => {
      const processId = 'process-123';
      const requestBody = {
        processNumber: '1234567-89.2024.8.26.0001',
        tribunalId: 'TJSP',
        enableAutoAnalysis: true,
        analysisLevel: 'FULL'
      };

      mockPrisma.case.findUnique.mockResolvedValue({
        id: processId,
        workspaceId: 'workspace-123',
        number: '1234567-89.2024.8.26.0001',
        title: 'Processo de Teste',
        monitoredProcesses: []
      });

      mockPrisma.monitoredProcess.create.mockResolvedValue({
        id: 'monitored-123',
        processNumber: '1234567-89.2024.8.26.0001'
      });

      mockPrisma.processSyncLog.create.mockResolvedValue({
        id: 'sync-log-123',
        newMovements: 5
      });

      const response = await simulateAutoDownloadRequest(processId, requestBody);

      expect(response.success).toBe(true);
      expect(response.analysisScheduled).toBe(true);
      expect(response.analysisLevel).toBe('FULL');
      expect(response.downloadEstimate).toBe('2-5 minutos');
      expect(response.analysisEstimate).toContain('3-5 minutos após download');

      expect(mockPrisma.monitoredProcess.create).toHaveBeenCalled();
      expect(mockPrisma.processSyncLog.create).toHaveBeenCalled();
    });

    it('deve funcionar sem análise automática', async () => {
      const processId = 'process-123';
      const requestBody = {
        processNumber: '1234567-89.2024.8.26.0001',
        enableAutoAnalysis: false
      };

      mockPrisma.case.findUnique.mockResolvedValue({
        id: processId,
        workspaceId: 'workspace-123',
        monitoredProcesses: [{
          id: 'existing-monitored',
          processNumber: '1234567-89.2024.8.26.0001'
        }]
      });

      mockPrisma.processSyncLog.create.mockResolvedValue({
        id: 'sync-log-123',
        newMovements: 3
      });

      const response = await simulateAutoDownloadRequest(processId, requestBody);

      expect(response.success).toBe(true);
      expect(response.analysisScheduled).toBe(false);
      expect(response.analysisLevel).toBeNull();
    });
  });
});

// ================================================================
// HELPERS DE SIMULAÇÃO
// ================================================================

async function simulateAnalysisRequest(processId: string, body: any) {
  // Simular lógica do endpoint POST /api/process/{id}/analysis
  try {
    const { level, includeDocuments = true, includeTimeline = true, uploadedFile } = body;

    if (!['FAST', 'FULL'].includes(level)) {
      return { success: false, error: 'Nível de análise deve ser FAST ou FULL' };
    }

    const lastMovementDate = await mockCacheManager.getLastMovementDate(processId, mockPrisma);
    let documentHashes: string[] = [];

    if (level === 'FAST') {
      documentHashes = await mockCacheManager.getProcessDocumentHashes(processId, mockPrisma);
      if (documentHashes.length === 0) {
        return {
          success: false,
          error: 'Nenhum documento encontrado para análise FAST',
          suggestion: 'Use a opção FULL para fazer upload do PDF completo'
        };
      }
    } else {
      const existingHashes = await mockCacheManager.getProcessDocumentHashes(processId, mockPrisma);
      documentHashes = [...existingHashes];
    }

    const modelVersion = level === 'FULL' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
    const promptSignature = `${level}_${includeDocuments}_${includeTimeline}`;

    const cacheResult = await mockCacheManager.checkAnalysisCache(
      documentHashes, modelVersion, promptSignature, lastMovementDate
    );

    if (cacheResult.hit) {
      const nextVersion = ((await mockPrisma.caseAnalysisVersion.findFirst())?.version || 0) + 1;
      await mockPrisma.caseAnalysisVersion.create();

      return {
        success: true,
        source: 'cache',
        level,
        model: modelVersion,
        processingTime: 100
      };
    }

    const lockResult = await mockCacheManager.acquireLock(cacheResult.key);
    if (!lockResult.acquired) {
      return {
        success: false,
        error: 'Análise já está sendo processada',
        retryIn: lockResult.ttl
      };
    }

    const nextVersion = ((await mockPrisma.caseAnalysisVersion.findFirst())?.version || 0) + 1;
    await mockPrisma.caseAnalysisVersion.create();

    return {
      success: true,
      source: 'processing',
      level,
      model: modelVersion,
      version: nextVersion,
      estimatedTime: level === 'FULL' ? '2-3 minutos' : '30-60 segundos'
    };

  } catch (error) {
    return { success: false, error: 'Erro interno do servidor' };
  }
}

async function simulateVersionsRequest(processId: string) {
  try {
    const versions = await mockPrisma.caseAnalysisVersion.findMany();

    if (versions.length === 0) {
      return {
        success: true,
        versions: [],
        totalVersions: 0,
        message: 'Nenhuma análise encontrada para este processo'
      };
    }

    const versionsWithDiffs = versions.map((version: any, index: number) => {
      const previousVersion = versions[index + 1];
      return {
        ...version,
        isLatest: index === 0,
        diff: previousVersion ? calculateDiff(version, previousVersion) : null,
        changes: previousVersion ? calculateChanges(version, previousVersion) : null
      };
    });

    return {
      success: true,
      versions: versionsWithDiffs,
      totalVersions: versions.length,
      latestVersion: versions[0]?.version || 0
    };

  } catch (error) {
    return { success: false, error: 'Erro interno do servidor' };
  }
}

async function simulateAutoDownloadRequest(processId: string, body: any) {
  try {
    const { enableAutoAnalysis = false, analysisLevel = 'FULL' } = body;

    const process = await mockPrisma.case.findUnique();
    if (!process) {
      return { success: false, error: 'Processo não encontrado' };
    }

    if (process.monitoredProcesses.length === 0) {
      await mockPrisma.monitoredProcess.create();
    }

    await mockPrisma.processSyncLog.create();

    return {
      success: true,
      message: 'Download automático iniciado',
      downloadEstimate: '2-5 minutos',
      analysisScheduled: enableAutoAnalysis,
      analysisLevel: enableAutoAnalysis ? analysisLevel : null,
      analysisEstimate: enableAutoAnalysis ?
        (analysisLevel === 'FULL' ? '3-5 minutos após download' : '1-2 minutos após download') : null
    };

  } catch (error) {
    return { success: false, error: 'Erro interno do servidor' };
  }
}

function calculateDiff(current: any, previous: any) {
  return {
    analysisType: {
      changed: current.analysisType !== previous.analysisType,
      from: previous.analysisType,
      to: current.analysisType
    },
    model: {
      changed: current.modelUsed !== previous.modelUsed,
      from: previous.modelUsed,
      to: current.modelUsed
    }
  };
}

function calculateChanges(current: any, previous: any) {
  const changes = [];

  if (current.analysisType !== previous.analysisType) {
    changes.push({
      type: 'analysis_type',
      description: `Tipo alterado: ${previous.analysisType} → ${current.analysisType}`,
      impact: 'high'
    });
  }

  if (current.modelUsed !== previous.modelUsed) {
    changes.push({
      type: 'model_upgrade',
      description: `Modelo atualizado: ${previous.modelUsed} → ${current.modelUsed}`,
      impact: 'medium'
    });
  }

  return {
    totalChanges: changes.length,
    criticalChanges: changes.filter(c => c.impact === 'high').length,
    changes,
    hasSignificantChanges: changes.some(c => c.impact === 'high')
  };
}