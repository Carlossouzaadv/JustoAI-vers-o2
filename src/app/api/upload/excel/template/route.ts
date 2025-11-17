// ================================================================
// API ENDPOINT - Download Excel Template
// ================================================================
// GET /api/upload/excel/template
//
// Retorna um modelo de Excel pronto para preenchimento
// Com:
// - Headers corretos (obrigatórios + opcionais)
// - Exemplos de linhas válidas
// - Instruções detalhadas em sheet separada
// - Validações e comentários em cada coluna

import { NextRequest, NextResponse } from 'next/server';
import { ExcelTemplateGenerator } from '@/lib/services/excel-template-generator';
import { ICONS } from '@/lib/icons';

/**
 * GET /api/upload/excel/template
 * Retorna arquivo Excel com template para preenchimento
 */
export async function GET(request: NextRequest) {
  console.log(`${ICONS.PROCESS} Gerando template de Excel...`);

  try {
    // Gerar template
    const buffer = await ExcelTemplateGenerator.generateTemplate();

    // Criar nome do arquivo com timestamp
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `JustoAI_Template_${timestamp}.xlsx`;

    console.log(`${ICONS.SUCCESS} Template gerado com sucesso (${buffer.length} bytes)`);

    // Retornar como arquivo para download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store', // Sempre gerar novo template (pode ter atualizações)
      },
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao gerar template:`, error);

    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao gerar template',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 }
    );
  }
}
