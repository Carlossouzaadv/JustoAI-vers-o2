// ================================================================
// API ENDPOINT - Upload Excel Validation (Phase 19 - Gold Standard)
// ================================================================
// POST /api/upload/excel/validate
//
// Validação Síncrona - Padrão-Ouro
// 1. ETAPA 1: Parsing (ler Excel em JSON)
// 2. ETAPA 2: Validação (aplicar schema Zod)
// 3. Feedback detalhado: linha + coluna + valor + erro
//
// Resposta de SUCESSO (200):
// { success: true, message: "...", statistics: {...} }
//
// Resposta de FALHA (400):
// { success: false, message: "...", errors: [...], statistics: {...} }

import { NextRequest, NextResponse } from 'next/server';
import { ExcelValidationService } from '@/lib/services/excel-validation-service';
import { ExcelParserSimple } from '@/lib/excel-parser-simple';
import { ICONS } from '@/lib/icons';

// ===== HANDLER PRINCIPAL =====

export async function POST(request: NextRequest) {
  console.log(`${ICONS.PROCESS} Iniciando validação de Excel (Fase 19 - Padrão-Ouro)...`);

  try {
    // 1. Validar Content-Type
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Content-Type deve ser multipart/form-data',
        },
        { status: 400 }
      );
    }

    // 2. Extrair FormData
    const formData = await request.formData();
    const file = formData.get('file');
    const workspaceId = formData.get('workspaceId');

    // 3. Type guards
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Arquivo não fornecido ou inválido',
        },
        { status: 400 }
      );
    }

    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'WorkspaceId é obrigatório',
        },
        { status: 400 }
      );
    }

    // 4. Validar arquivo
    const fileValidationError = validateFile(file);
    if (fileValidationError) {
      return NextResponse.json(
        { success: false, message: fileValidationError },
        { status: 400 }
      );
    }

    // 5. Converter para buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`${ICONS.PROCESS} Arquivo recebido: ${file.name} (${file.size} bytes)`);

    // 6. ETAPA 1: PARSING (ler Excel em JSON)
    console.log(`${ICONS.PROCESS} Executando ETAPA 1: Parsing...`);
    let rows: Array<Record<string, unknown>>;

    try {
      rows = await ExcelParserSimple.parseToJson(buffer);
    } catch (_error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log(`${ICONS.ERROR} Erro no parsing:`, message);

      return NextResponse.json(
        {
          success: false,
          message: `Erro ao ler arquivo Excel: ${message}`,
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Arquivo vazio ou sem dados válidos',
        },
        { status: 400 }
      );
    }

    console.log(`${ICONS.PROCESS} ${rows.length} linhas extraídas`);

    // 7. ETAPA 2: VALIDAÇÃO (aplicar schema Zod)
    console.log(`${ICONS.PROCESS} Executando ETAPA 2: Validação com schema...`);
    const validationResult = ExcelValidationService.validateBatch(rows);

    console.log(
      `${ICONS.SUCCESS} Validação concluída: ${validationResult.statistics?.validRows || 0} válidas, ${validationResult.statistics?.invalidRows || 0} com erro`
    );

    // 8. Retornar resultado (200 se sucesso, 400 se houver erros)
    return NextResponse.json(
      {
        success: validationResult.success,
        message: validationResult.message,
        errors: validationResult.errors,
        statistics: validationResult.statistics,
        file: {
          name: file.name,
          size: file.size,
        },
      },
      { status: validationResult.success ? 200 : 400 }
    );
  } catch (_error) {
    console.error(`${ICONS.ERROR} Erro na validação:`, error);

    return NextResponse.json(
      {
        success: false,
        message: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 }
    );
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Valida arquivo antes do parsing
 * Retorna mensagem de erro ou null se válido
 */
function validateFile(file: File): string | null {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    return 'Arquivo deve ser Excel (.xlsx ou .xls)';
  }

  if (file.size > 10 * 1024 * 1024) {
    return 'Arquivo muito grande (máximo 10MB)';
  }

  if (file.size === 0) {
    return 'Arquivo vazio';
  }

  return null;
}
