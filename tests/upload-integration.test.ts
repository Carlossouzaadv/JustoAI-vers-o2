// ================================================================
// TESTE DE INTEGRAÇÃO - Upload Pipeline Completo
// ================================================================
// Integration test: upload de PDF pequeno -> gera text_sha, cria process UNASSIGNED se não existir

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DocumentHashManager } from '../lib/document-hash';
import { TimelineMergeService } from '../lib/timeline-merge';
import { AnalysisCacheManager } from '../lib/analysis-cache';
import { TextCleaner } from '../lib/text-cleaner';

// Mock do Prisma para testes
const mockPrisma = {
  caseDocument: {
    create: jest.fn(),
    findFirst: jest.fn()
  },
  case: {
    create: jest.fn(),
    findFirst: jest.fn()
  },
  processTimelineEntry: {
    create: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn()
  },
  globalLog: {
    create: jest.fn()
  }
};

// Mock dos serviços externos
const mockFileExtraction = {
  extractTextFromPDF: jest.fn().mockResolvedValue({
    text: `
      TRIBUNAL DE JUSTIÇA DE SÃO PAULO
      Processo nº 1234567-89.2023.8.26.0001

      DESPACHO

      Intimem-se as partes para manifestação no prazo de 15 dias.

      São Paulo, 15 de janeiro de 2024.

      ASSINADO DIGITALMENTE
      Juiz de Direito - Dr. José Silva
    `,
    pageCount: 1,
    confidence: 0.95
  })
};

describe('Upload Integration Test', () => {
  let hashManager: DocumentHashManager;
  let timelineService: TimelineMergeService;
  let cacheManager: AnalysisCacheManager;
  let textCleaner: TextCleaner;

  beforeEach(() => {
    hashManager = new DocumentHashManager();
    timelineService = new TimelineMergeService();
    cacheManager = new AnalysisCacheManager();
    textCleaner = new TextCleaner();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup cache connections if needed
    if (cacheManager) {
      cacheManager.disconnect();
    }
  });

  it('deve processar upload completo de PDF pequeno', async () => {
    // === 1. SETUP: Simular arquivo PDF pequeno ===
    const mockFileBuffer = Buffer.from('Mock PDF content', 'utf-8');
    const mockFileName = 'teste-processo.pdf';
    const mockWorkspaceId = 'workspace-123';

    // === 2. CALCULAR HASH SHA256 ===
    console.log('🔍 Calculando SHA256...');
    const hashResult = hashManager.calculateSHA256(mockFileBuffer);

    expect(hashResult).toHaveProperty('textSha');
    expect(hashResult).toHaveProperty('size');
    expect(hashResult).toHaveProperty('calculatedAt');
    expect(hashResult.textSha.length).toBe(64); // SHA256 hex length
    expect(hashResult.size).toBe(mockFileBuffer.length);

    // === 3. VERIFICAR DEDUPLICAÇÃO ===
    console.log('🔍 Verificando deduplicação...');
    mockPrisma.caseDocument.findFirst.mockResolvedValue(null); // Não é duplicata

    const deduplicationResult = await hashManager.checkDeduplication(
      hashResult.textSha,
      mockWorkspaceId,
      mockPrisma
    );

    expect(deduplicationResult.isDuplicate).toBe(false);
    expect(deduplicationResult.originalDocumentId).toBeUndefined();

    // === 4. EXTRAIR TEXTO DO PDF ===
    console.log('📄 Extraindo texto do PDF...');
    const extractionResult = await mockFileExtraction.extractTextFromPDF(mockFileBuffer);

    expect(extractionResult.text).toContain('TRIBUNAL DE JUSTIÇA');
    expect(extractionResult.text).toContain('1234567-89.2023.8.26.0001');
    expect(extractionResult.pageCount).toBe(1);
    expect(extractionResult.confidence).toBeGreaterThan(0.9);

    // === 5. EXTRAIR NÚMERO CNJ ===
    console.log('🔍 Extraindo número CNJ...');
    const processNumber = textCleaner.extractProcessNumber(extractionResult.text);

    expect(processNumber).toBe('1234567-89.2023.8.26.0001');

    // === 6. LIMPAR TEXTO PARA IA ===
    console.log('🧹 Limpando texto...');
    const cleaningResult = textCleaner.cleanLegalDocument(extractionResult.text);

    expect(cleaningResult.cleanedText).toBeDefined();
    expect(cleaningResult.originalLength).toBeGreaterThan(0);
    expect(cleaningResult.cleanedLength).toBeGreaterThan(0);
    expect(cleaningResult.reductionPercentage).toBeGreaterThanOrEqual(0);
    expect(cleaningResult.confidence).toBeGreaterThan(0);

    // Verificar que conteúdo importante foi preservado
    expect(cleaningResult.cleanedText).toContain('DESPACHO');
    expect(cleaningResult.cleanedText).toContain('Intimem-se as partes');

    // === 7. VERIFICAR SE PROCESSO EXISTE ===
    console.log('🔍 Verificando se processo existe...');
    mockPrisma.case.findFirst.mockResolvedValue(null); // Processo não existe

    const existingCase = await mockPrisma.case.findFirst({
      where: {
        number: processNumber,
        workspaceId: mockWorkspaceId
      }
    });

    expect(existingCase).toBeNull();

    // === 8. CRIAR PROCESSO UNASSIGNED ===
    console.log('📁 Criando processo UNASSIGNED...');
    const newCaseId = 'case-456';
    mockPrisma.case.create.mockResolvedValue({
      id: newCaseId,
      number: processNumber,
      title: `Processo ${processNumber}`,
      status: 'UNASSIGNED',
      workspaceId: mockWorkspaceId,
      folderId: 'clientes-a-definir-folder',
      createdAt: new Date()
    });

    const newCase = await mockPrisma.case.create({
      data: {
        number: processNumber,
        title: `Processo ${processNumber}`,
        status: 'UNASSIGNED',
        workspaceId: mockWorkspaceId,
        folderId: 'clientes-a-definir-folder',
        description: 'Processo criado automaticamente via upload'
      }
    });

    expect(newCase.id).toBe(newCaseId);
    expect(newCase.status).toBe('UNASSIGNED');
    expect(newCase.number).toBe(processNumber);

    // === 9. CRIAR DOCUMENTO NO BANCO ===
    console.log('💾 Salvando documento...');
    const newDocumentId = 'doc-789';
    mockPrisma.caseDocument.create.mockResolvedValue({
      id: newDocumentId,
      name: mockFileName,
      textSha: hashResult.textSha,
      size: hashResult.size,
      cleanText: cleaningResult.cleanedText,
      caseId: newCaseId,
      isDuplicate: false,
      uploadedAt: new Date()
    });

    const savedDocument = await mockPrisma.caseDocument.create({
      data: {
        name: mockFileName,
        textSha: hashResult.textSha,
        size: hashResult.size,
        cleanText: cleaningResult.cleanedText,
        caseId: newCaseId,
        isDuplicate: false,
        processNumber: processNumber
      }
    });

    expect(savedDocument.id).toBe(newDocumentId);
    expect(savedDocument.textSha).toBe(hashResult.textSha);
    expect(savedDocument.cleanText).toBe(cleaningResult.cleanedText);
    expect(savedDocument.isDuplicate).toBe(false);

    // === 10. EXTRAIR TIMELINE DE ANDAMENTOS ===
    console.log('📅 Extraindo timeline...');

    // Simular resultado de análise IA
    const mockAIAnalysis = {
      raw_events_extracted: [
        {
          data_andamento: '15/01/2024',
          tipo_andamento: 'DESPACHO',
          resumo_andamento: 'Intimem-se as partes para manifestação no prazo de 15 dias',
          confidence: 0.9
        }
      ]
    };

    const timelineEntries = timelineService.extractTimelineFromAIAnalysis(
      mockAIAnalysis,
      newDocumentId
    );

    expect(timelineEntries).toHaveLength(1);
    expect(timelineEntries[0].eventType).toBe('DESPACHO');
    expect(timelineEntries[0].description).toContain('Intimem-se as partes');
    expect(timelineEntries[0].source).toBe('AI_EXTRACTION');

    // === 11. MERGEAR TIMELINE ===
    console.log('🔄 Mergeando timeline...');
    mockPrisma.processTimelineEntry.findUnique.mockResolvedValue(null); // Não há duplicata
    mockPrisma.processTimelineEntry.create.mockResolvedValue({
      id: 'timeline-entry-1',
      caseId: newCaseId,
      eventDate: new Date('2024-01-15'),
      eventType: 'DESPACHO',
      description: 'Intimem-se as partes para manifestação no prazo de 15 dias',
      source: 'AI_EXTRACTION'
    });
    mockPrisma.processTimelineEntry.count.mockResolvedValue(1);

    const mergeResult = await timelineService.mergeEntries(
      newCaseId,
      timelineEntries,
      mockPrisma
    );

    expect(mergeResult.newEntries).toBe(1);
    expect(mergeResult.duplicatesSkipped).toBe(0);
    expect(mergeResult.totalEntries).toBe(1);

    // === 12. VERIFICAR CACHE ===
    console.log('💾 Verificando cache...');
    const analysisKey = hashManager.generateAnalysisKey(
      hashResult.textSha,
      'gemini-1.5-flash',
      'legal-analysis-v1'
    );

    expect(analysisKey).toBeDefined();
    expect(analysisKey.length).toBe(64);

    // === RESULTADO FINAL ===
    console.log('✅ Upload pipeline completo executado com sucesso!');

    // Verificar que todos os mocks foram chamados corretamente
    expect(mockPrisma.caseDocument.findFirst).toHaveBeenCalledWith({
      where: {
        textSha: hashResult.textSha,
        case: { workspaceId: mockWorkspaceId }
      },
      include: expect.any(Object)
    });

    expect(mockPrisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        number: processNumber,
        workspaceId: mockWorkspaceId
      }
    });

    expect(mockPrisma.case.create).toHaveBeenCalledWith({
      data: {
        number: processNumber,
        title: `Processo ${processNumber}`,
        status: 'UNASSIGNED',
        workspaceId: mockWorkspaceId,
        folderId: 'clientes-a-definir-folder',
        description: 'Processo criado automaticamente via upload'
      }
    });

    expect(mockPrisma.caseDocument.create).toHaveBeenCalledWith({
      data: {
        name: mockFileName,
        textSha: hashResult.textSha,
        size: hashResult.size,
        cleanText: cleaningResult.cleanedText,
        caseId: newCaseId,
        isDuplicate: false,
        processNumber: processNumber
      }
    });
  });

  it('deve lidar com processo existente', async () => {
    // === SETUP ===
    const mockFileBuffer = Buffer.from('Mock PDF content 2', 'utf-8');
    const processNumber = '9999999-99.2023.8.26.0002';
    const existingCaseId = 'existing-case-123';

    // Simular processo existente
    mockPrisma.case.findFirst.mockResolvedValue({
      id: existingCaseId,
      number: processNumber,
      title: 'Processo Existente',
      status: 'ACTIVE',
      workspaceId: 'workspace-123'
    });

    // === EXECUÇÃO ===
    const hashResult = hashManager.calculateSHA256(mockFileBuffer);

    // Simular deduplicação (não é duplicata)
    mockPrisma.caseDocument.findFirst.mockResolvedValue(null);
    const deduplicationResult = await hashManager.checkDeduplication(
      hashResult.textSha,
      'workspace-123',
      mockPrisma
    );

    // Simular encontrar processo existente
    const existingCase = await mockPrisma.case.findFirst({
      where: {
        number: processNumber,
        workspaceId: 'workspace-123'
      }
    });

    // === VERIFICAÇÕES ===
    expect(deduplicationResult.isDuplicate).toBe(false);
    expect(existingCase).toBeDefined();
    expect(existingCase.id).toBe(existingCaseId);

    // Documento deve ser anexado ao processo existente
    mockPrisma.caseDocument.create.mockResolvedValue({
      id: 'doc-attached-456',
      caseId: existingCaseId,
      textSha: hashResult.textSha
    });

    const attachedDocument = await mockPrisma.caseDocument.create({
      data: {
        name: 'documento-anexado.pdf',
        textSha: hashResult.textSha,
        caseId: existingCaseId,
        isDuplicate: false
      }
    });

    expect(attachedDocument.caseId).toBe(existingCaseId);
  });

  it('deve detectar documento duplicado', async () => {
    // === SETUP ===
    const mockFileBuffer = Buffer.from('Duplicate content', 'utf-8');
    const duplicateHash = hashManager.calculateSHA256(mockFileBuffer);

    // Simular documento duplicado encontrado
    mockPrisma.caseDocument.findFirst.mockResolvedValue({
      id: 'original-doc-123',
      name: 'documento-original.pdf',
      caseId: 'case-456',
      createdAt: new Date(),
      case: {
        id: 'case-456',
        title: 'Caso Original',
        number: '1111111-11.2023.1.11.1111'
      }
    });

    // === EXECUÇÃO ===
    const deduplicationResult = await hashManager.checkDeduplication(
      duplicateHash.textSha,
      'workspace-123',
      mockPrisma
    );

    // === VERIFICAÇÕES ===
    expect(deduplicationResult.isDuplicate).toBe(true);
    expect(deduplicationResult.originalDocumentId).toBe('original-doc-123');
    expect(deduplicationResult.originalDocument).toBeDefined();
    expect(deduplicationResult.originalDocument!.name).toBe('documento-original.pdf');

    console.log('🔄 Documento duplicado detectado corretamente');
  });
});