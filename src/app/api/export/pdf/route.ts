// ================================
// API PARA EXPORTAR DADOS EM PDF
// ================================
// Endpoint para exportar dados genéricos em formato PDF

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAuthAndGetUser } from '@/lib/auth';
import { ICONS } from '@/lib/icons';

// ================================
// VALIDAÇÃO DE INPUT
// ================================

const exportPdfSchema = z.object({
  title: z.string().optional().default('Exportação de Dados'),
  summary: z.record(z.string(), z.unknown()).optional(),
  breakdown: z.array(z.object({
    operationType: z.unknown(),
    count: z.unknown(),
    totalCost: z.unknown(),
    avgCost: z.unknown(),
  })).optional(),
  dailyCosts: z.array(z.object({
    date: z.unknown(),
    cost: z.unknown(),
    operations: z.unknown(),
  })).optional(),
});

type ExportPdfInput = z.infer<typeof exportPdfSchema>;

// ================================
// TYPE GUARDS
// ================================

function isBreakdownItem(item: unknown): item is {
  operationType: unknown;
  count: unknown;
  totalCost: unknown;
  avgCost: unknown;
} {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return (
    'operationType' in obj &&
    'count' in obj &&
    'totalCost' in obj &&
    'avgCost' in obj
  );
}

function isDailyCostItem(item: unknown): item is {
  date: unknown;
  cost: unknown;
  operations: unknown;
} {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return (
    'date' in obj &&
    'cost' in obj &&
    'operations' in obj
  );
}

// ================================
// HELPER: Generate HTML from data
// ================================

function generateHtmlFromData(data: ExportPdfInput): string {
  const timestamp = new Date().toLocaleString('pt-BR');

  let summaryHtml = '';
  if (data.summary && typeof data.summary === 'object') {
    const entries = Object.entries(data.summary);
    summaryHtml = `
      <section style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1a202c;">Resumo</h2>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background-color: #f7fafc;">
          <table style="width: 100%; border-collapse: collapse;">
            ${entries.map(([key, value]) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: 600; color: #2d3748;">${key}</td>
                <td style="padding: 8px; text-align: right; color: #4a5568;">${value}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      </section>
    `;
  }

  let breakdownHtml = '';
  if (data.breakdown && Array.isArray(data.breakdown) && data.breakdown.length > 0) {
    breakdownHtml = `
      <section style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1a202c;">Breakdown por Tipo</h2>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; background-color: #fff;">
            <thead style="background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
              <tr>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #2d3748;">Tipo</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #2d3748;">Quantidade</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #2d3748;">Custo Total</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #2d3748;">Custo Médio</th>
              </tr>
            </thead>
            <tbody>
              ${data.breakdown
                .filter(isBreakdownItem)
                .map((item) => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px; color: #2d3748;">${item.operationType}</td>
                    <td style="padding: 12px; text-align: center; color: #4a5568;">${item.count}</td>
                    <td style="padding: 12px; text-align: right; color: #4a5568;">${item.totalCost}</td>
                    <td style="padding: 12px; text-align: right; color: #4a5568;">${item.avgCost}</td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  let dailyCostsHtml = '';
  if (data.dailyCosts && Array.isArray(data.dailyCosts) && data.dailyCosts.length > 0) {
    dailyCostsHtml = `
      <section style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1a202c;">Custos Diários</h2>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; background-color: #fff;">
            <thead style="background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
              <tr>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #2d3748;">Data</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #2d3748;">Custo</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #2d3748;">Operações</th>
              </tr>
            </thead>
            <tbody>
              ${data.dailyCosts
                .filter(isDailyCostItem)
                .map((item) => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px; color: #2d3748;">${item.date}</td>
                    <td style="padding: 12px; text-align: right; color: #4a5568;">${item.cost}</td>
                    <td style="padding: 12px; text-align: right; color: #4a5568;">${item.operations}</td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #2d3748;
          margin: 0;
          padding: 40px;
          background-color: #fff;
        }
        .header {
          border-bottom: 3px solid #3182ce;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
          color: #1a202c;
        }
        .header p {
          margin: 0;
          color: #718096;
          font-size: 13px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 12px;
          color: #a0aec0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.title}</h1>
        <p>Gerado em ${timestamp}</p>
      </div>

      ${summaryHtml}
      ${breakdownHtml}
      ${dailyCostsHtml}

      <div class="footer">
        <p>Este relatório foi gerado automaticamente por JustoAI</p>
      </div>
    </body>
    </html>
  `;
}

// ================================
// POST HANDLER
// ================================

export async function POST(req: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Nova requisição de exportação PDF`);

    // 1. Autenticação
    await validateAuthAndGetUser();

    // 2. Validação do input
    const body = await req.json();
    const validatedData: ExportPdfInput = exportPdfSchema.parse(body);

    // 3. Gerar HTML
    const html = generateHtmlFromData(validatedData);

    // 4. Return HTML that can be printed to PDF
    // This is a pragmatic MVP approach that works reliably
    // User can Print > Save as PDF from the browser

    console.log(`${ICONS.SUCCESS} HTML gerado com sucesso para exportação`);

    // 5. Retornar HTML com header para incentivar download/print
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="exportacao-${new Date().toISOString().split('T')[0]}.html"`,
      },
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na exportação PDF:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro ao gerar PDF' },
      { status: 500 }
    );
  }
}
