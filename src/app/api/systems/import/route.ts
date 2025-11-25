// ================================
// API IMPORTAÇÃO DE SISTEMAS EXTERNOS
// ================================
// Upload CSV/Excel com detecção inteligente de sistemas jurídicos

import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, errorResponse, ApiError } from '@/lib/api-utils';
import { createSystemImporter, type ImportOptions } from '@/lib/system-importer';
import { createIntelligentParser } from '@/lib/intelligent-parser';
import { SystemMappings } from '@/lib/system-mappings';
import { ICONS } from '@/lib/icons';

// ================================
// TYPE GUARDS E VALIDAÇÃO
// ================================

/** Type Guard para validar Partial<ImportOptions> */
function isPartialImportOptions(data: unknown): data is Partial<ImportOptions> {
  // Objeto vazio ou nulo é válido para Partial<>
  if (typeof data !== 'object' || data === null) {
    return true;
  }

  const obj = data as Record<string, unknown>;

  // Validar cada propriedade opcional
  if (
    obj.overwriteExisting !== undefined &&
    typeof obj.overwriteExisting !== 'boolean'
  ) {
    return false;
  }

  if (
    obj.skipDuplicates !== undefined &&
    typeof obj.skipDuplicates !== 'boolean'
  ) {
    return false;
  }

  if (obj.validateOnly !== undefined && typeof obj.validateOnly !== 'boolean') {
    return false;
  }

  if (obj.batchSize !== undefined && typeof obj.batchSize !== 'number') {
    return false;
  }

  if (
    obj.customMappings !== undefined &&
    (typeof obj.customMappings !== 'object' || obj.customMappings === null)
  ) {
    return false;
  }

  if (
    obj.transformRules !== undefined &&
    (typeof obj.transformRules !== 'object' || obj.transformRules === null)
  ) {
    return false;
  }

  return true;
}

/** Helper para validar e extrair arquivo do FormData */
async function extractFileFromRequest(
  request: NextRequest
): Promise<{ file: File; filename: string }> {
  const formData = await request.formData();
  const fileInput = formData.get('file');

  if (!fileInput || !(fileInput instanceof File)) {
    throw new ApiError('Arquivo não encontrado ou inválido', 400);
  }

  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv'
  ];

  if (!allowedMimes.includes(fileInput.type)) {
    throw new ApiError(
      'Apenas arquivos Excel (.xlsx, .xls) e CSV são permitidos',
      400
    );
  }

  return {
    file: fileInput,
    filename: fileInput.name
  };
}

// ================================
// SCHEMAS DE VALIDAÇÃO
// ================================

const ImportRequestSchema = z.object({
  overwriteExisting: z.boolean().default(false),
  skipDuplicates: z.boolean().default(true),
  validateOnly: z.boolean().default(false),
  batchSize: z.number().min(10).max(1000).default(100),
  customMappings: z.record(z.string(), z.string()).optional(),
  forceSystem: z.enum(['PROJURIS', 'LEGAL_ONE', 'ASTREA', 'CP_PRO', 'SAJ', 'ESAJ', 'PJE', 'THEMIS', 'ADVBOX']).optional()
});

// ================================
// POST - UPLOAD E ANÁLISE DE ARQUIVO
// ================================

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    const { user: _user, workspace } = await validateAuth();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analyze';

    // Extrair arquivo do FormData
    const { file, filename } = await extractFileFromRequest(request);

    // Converter File para Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`${ICONS.UPLOAD} Upload de sistema externo:`, {
      filename,
      size: file.size,
      type: file.type,
      workspace: workspace.name,
      action
    });

    if (action === 'analyze') {
      return await handleAnalyzeFile(buffer, filename, workspace.id);
    } else if (action === 'import') {
      return await handleImportFile(buffer, filename, workspace.id, request);
    } else {
      throw new ApiError('Ação não suportada. Use action=analyze ou action=import', 400);
    }

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro no upload de sistema:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// GET - LISTAR IMPORTAÇÕES E SISTEMAS
// ================================

export async function GET(request: NextRequest) {
  try {
    const { workspace } = await validateAuth();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    if (action === 'systems') {
      // Listar sistemas suportados
      const supportedSystems = SystemMappings.getSupportedSystems();

      const systemsInfo = supportedSystems
        .filter(system => system !== 'UNKNOWN')
        .map(system => {
          const mapping = SystemMappings.getMapping(system);
          return {
            system,
            name: mapping.description,
            version: mapping.version,
            columnCount: mapping.columnMappings.length,
            categories: [...new Set(mapping.columnMappings.map(c => c.category))],
            hasTransformRules: mapping.transformRules.length > 0,
            hasValidationRules: mapping.validationRules.length > 0
          };
        });

      return apiResponse({
        supportedSystems: systemsInfo,
        totalSystems: systemsInfo.length
      });
    }

    if (action === 'templates') {
      // Listar templates de mapeamento
      const templates = await prisma.systemMappingTemplate.findMany({
        where: { workspaceId: workspace.id },
        orderBy: [
          { isDefault: 'desc' },
          { usageCount: 'desc' },
          { updatedAt: 'desc' }
        ],
        select: {
          id: true,
          name: true,
          description: true,
          sourceSystem: true,
          version: true,
          isDefault: true,
          isActive: true,
          usageCount: true,
          lastUsedAt: true,
          updatedAt: true
        }
      });

      return apiResponse({
        templates,
        totalTemplates: templates.length
      });
    }

    // Listar importações recentes (padrão)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const [imports, totalImports] = await Promise.all([
      prisma.systemImport.findMany({
        where: { workspaceId: workspace.id },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          sourceSystem: true,
          detectedFormat: true,
          status: true,
          progress: true,
          totalRows: true,
          processedRows: true,
          successfulRows: true,
          failedRows: true,
          importedCases: true,
          importedClients: true,
          importedEvents: true,
          importedDocuments: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          errors: true,
          warnings: true,
          summary: true
        }
      }),
      prisma.systemImport.count({
        where: { workspaceId: workspace.id }
      })
    ]);

    // Estatísticas rápidas
    const stats = await prisma.systemImport.groupBy({
      by: ['status'],
      where: { workspaceId: workspace.id },
      _count: true
    });

    // Interface para o resultado do groupBy
    interface StatusGroupResult {
      status: string;
      _count: number;
    }

    const statusStats = stats.reduce((acc: Record<string, number>, stat: StatusGroupResult) => {
      acc[stat.status] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    return apiResponse({
      imports,
      pagination: {
        page,
        limit,
        total: totalImports,
        totalPages: Math.ceil(totalImports / limit)
      },
      stats: {
        total: totalImports,
        byStatus: statusStats
      }
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro ao buscar importações:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// DELETE - REMOVER IMPORTAÇÕES
// ================================

export async function DELETE(request: NextRequest) {
  try {
    const { workspace } = await validateAuth();
    const { searchParams } = new URL(request.url);

    const importIds = searchParams.get('ids')?.split(',').filter(Boolean);

    if (!importIds || importIds.length === 0) {
      throw new ApiError('IDs das importações devem ser fornecidos', 400);
    }

    // Verificar se as importações pertencem ao workspace
    const importsToDelete = await prisma.systemImport.findMany({
      where: {
        id: { in: importIds },
        workspaceId: workspace.id
      },
      select: {
        id: true,
        fileName: true,
        status: true
      }
    });

    if (importsToDelete.length === 0) {
      throw new ApiError('Nenhuma importação encontrada para remoção', 404);
    }

    // Interface para o tipo de importação a ser deletada
    interface ImportToDelete {
      id: string;
      fileName: string;
      status: string;
    }

    // Não permitir remoção de importações em andamento
    const inProgress = importsToDelete.filter((imp: ImportToDelete) =>
      imp.status === 'ANALYZING' ||
      imp.status === 'MAPPING' ||
      imp.status === 'VALIDATING' ||
      imp.status === 'IMPORTING'
    );

    if (inProgress.length > 0) {
      throw new ApiError(
        `Não é possível remover importações em andamento: ${inProgress.map((i: ImportToDelete) => i.fileName).join(', ')}`,
        400
      );
    }

    // Remover importações (cascade automático remove itens relacionados)
    const deleted = await prisma.systemImport.deleteMany({
      where: {
        id: { in: importsToDelete.map((i: ImportToDelete) => i.id) }
      }
    });

    console.log(`${ICONS.SUCCESS} Importações removidas:`, {
      count: deleted.count,
      files: importsToDelete.map((i: ImportToDelete) => i.fileName)
    });

    return apiResponse({
      deleted: deleted.count,
      imports: importsToDelete,
      message: `${deleted.count} importações removidas`
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro ao remover importações:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// HANDLERS ESPECÍFICOS
// ================================

async function handleAnalyzeFile(
  buffer: Buffer,
  filename: string,
  workspaceId: string
) {
  console.log(`${ICONS.SEARCH} Analisando arquivo: ${filename}`);

  const parser = createIntelligentParser();
  const analysisResult = await parser.parseFile(buffer, filename);

  if (!analysisResult.success) {
    throw new ApiError(
      `Erro na análise: ${analysisResult.validationResult.errors[0]?.message || 'Arquivo inválido'}`,
      400
    );
  }

  // Buscar templates existentes para o sistema detectado
  const availableTemplates = await prisma.systemMappingTemplate.findMany({
    where: {
      workspaceId,
      sourceSystem: analysisResult.detectedSystem,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      description: true,
      version: true,
      isDefault: true,
      usageCount: true
    },
    orderBy: [
      { isDefault: 'desc' },
      { usageCount: 'desc' }
    ]
  });

  const result = {
    success: true,
    analysis: {
      detectedSystem: analysisResult.detectedSystem,
      confidence: analysisResult.confidence,
      fileAnalysis: analysisResult.fileAnalysis,
      totalRows: analysisResult.totalRows,
      headerRow: analysisResult.headerRow
    },
    preview: {
      headers: analysisResult.dataPreview[0] || [],
      sampleData: analysisResult.dataPreview.slice(1, 6), // 5 linhas de exemplo
      columnMapping: analysisResult.columnMapping,
      fieldMapping: analysisResult.fieldMapping
    },
    validation: {
      isValid: analysisResult.validationResult.isValid,
      completeness: analysisResult.validationResult.completeness,
      requiredFieldsCoverage: analysisResult.validationResult.requiredFieldsCoverage,
      errorCount: analysisResult.validationResult.errors.length,
      warningCount: analysisResult.validationResult.warnings.length,
      errors: analysisResult.validationResult.errors.slice(0, 10), // Primeiros 10 erros
      warnings: analysisResult.validationResult.warnings.slice(0, 5) // Primeiros 5 avisos
    },
    recommendations: analysisResult.recommendations,
    availableTemplates,
    nextSteps: {
      canProceedImport: analysisResult.validationResult.isValid && analysisResult.confidence > 0.5,
      suggestedAction: analysisResult.confidence > 0.8 ? 'IMPORT' : 'REVIEW_MAPPING',
      estimatedImportTime: Math.ceil(analysisResult.totalRows / 100) // Estimativa em segundos
    }
  };

  console.log(`${ICONS.SUCCESS} Análise concluída:`, {
    system: analysisResult.detectedSystem,
    confidence: `${Math.round(analysisResult.confidence * 100)}%`,
    rows: analysisResult.totalRows,
    valid: analysisResult.validationResult.isValid
  });

  return apiResponse(result);
}

async function handleImportFile(
  buffer: Buffer,
  filename: string,
  workspaceId: string,
  request: NextRequest
) {
  // Extrair configurações do corpo da requisição
  const formData = await request.formData();
  const configJson = formData.get('config')?.toString();

  let importConfig: unknown = {};
  if (configJson) {
    try {
      importConfig = JSON.parse(configJson);
    } catch {
      throw new ApiError('Configuração de importação inválida', 400);
    }
  }

  // Validar config usando Type Guard antes de usar
  if (!isPartialImportOptions(importConfig)) {
    throw new ApiError('Configuração de importação possui campos inválidos', 400);
  }

  const validatedConfig = ImportRequestSchema.parse(importConfig);

  console.log(`${ICONS.PROCESS} Iniciando importação: ${filename}`);

  const importer = createSystemImporter();

  // Iniciar importação em background se não for apenas validação
  if (validatedConfig.validateOnly) {
    const session = await importer.startImportSession(
      workspaceId,
      buffer,
      filename,
      validatedConfig
    );

    return apiResponse({
      success: true,
      importId: session.id,
      validation: {
        totalRows: session.totalRows,
        successful: session.successfulRows,
        failed: session.failedRows,
        errors: session.errors.slice(0, 10),
        warnings: session.warnings.slice(0, 5)
      },
      summary: session.summary,
      message: 'Validação concluída'
    });
  } else {
    // Importação real - executar em background
    importInBackground(workspaceId, buffer, filename, validatedConfig);

    return apiResponse({
      success: true,
      message: 'Importação iniciada em background. Use o endpoint de status para acompanhar o progresso.',
      estimatedTime: `${Math.ceil(buffer.length / (1024 * 1024))} minutos` // Estimativa baseada no tamanho
    });
  }
}

// ================================
// PROCESSAMENTO EM BACKGROUND
// ================================

async function importInBackground(
  workspaceId: string,
  buffer: Buffer,
  fileName: string,
  config: Partial<ImportOptions>
) {
  try {
    console.log(`${ICONS.PROCESS} Processamento em background iniciado: ${fileName}`);

    const importer = createSystemImporter();
    const session = await importer.startImportSession(workspaceId, buffer, fileName, config);

    console.log(`${ICONS.SUCCESS} Importação em background concluída:`, {
      id: session.id,
      system: session.sourceSystem,
      successful: session.successfulRows,
      failed: session.failedRows
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro na importação em background:`, error);
    // Erro já foi registrado no banco pelo importer
  }
}

// ================================
// CONFIGURAÇÃO NEXT.JS
// ================================

export const config = {
  api: {
    bodyParser: false,
  },
};