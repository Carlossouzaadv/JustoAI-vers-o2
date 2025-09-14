// ================================
// TEMPLATES HTML/CSS PARA RELATÓRIOS PDF
// ================================
// Sistema de templates otimizado para geração rápida de PDFs executivos

import { ICONS } from './icons';

// ================================
// TIPOS E INTERFACES
// ================================

export interface ReportCustomization {
  client_logo?: string; // Base64 ou URL
  company_name: string;
  company_address?: string;
  primary_color: string;   // #1E40AF
  secondary_color: string; // #64748B
  accent_color: string;    // #10B981
  header_text?: string;
  footer_text?: string;
  show_page_numbers: boolean;
  watermark?: string;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  generated_at: Date;
  generated_by: string;
  workspace_name: string;
  period?: {
    from: Date;
    to: Date;
  };
  summary: {
    total_processes: number;
    active_processes: number;
    new_movements: number;
    critical_alerts: number;
    pending_actions: number;
  };
  processes: ProcessReportData[];
  charts?: ChartData[];
  insights?: string[];
}

export interface ProcessReportData {
  id: string;
  number: string;
  client_name: string;
  subject: string;
  court: string;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  last_movement?: {
    date: Date;
    description: string;
    requires_action: boolean;
  };
  next_deadline?: Date;
  recent_movements?: Array<{
    date: Date;
    type: string;
    description: string;
    importance: string;
  }>;
  ai_insights?: string[];
  financial_info?: {
    case_value?: number;
    costs_incurred?: number;
    estimated_duration?: string;
  };
}

export interface ChartData {
  type: 'pie' | 'bar' | 'line';
  title: string;
  data: any[];
  labels: string[];
}

export type ReportType = 'complete' | 'updates' | 'executive' | 'financial';

// ================================
// ESTILOS CSS BASE
// ================================

export const BASE_STYLES = `
  <style>
    /* Reset e Base */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #1f2937;
      background: white;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
      position: relative;
    }

    /* Header personalizado */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--primary-color);
      margin-bottom: 30px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .client-logo {
      max-width: 80px;
      max-height: 60px;
      object-fit: contain;
    }

    .company-info h1 {
      font-size: 24px;
      font-weight: bold;
      color: var(--primary-color);
      margin-bottom: 4px;
    }

    .company-info p {
      font-size: 11px;
      color: var(--secondary-color);
    }

    .header-right {
      text-align: right;
    }

    .report-meta {
      font-size: 11px;
      color: var(--secondary-color);
    }

    /* Títulos */
    .report-title {
      font-size: 28px;
      font-weight: bold;
      color: var(--primary-color);
      margin-bottom: 8px;
      text-align: center;
    }

    .report-subtitle {
      font-size: 16px;
      color: var(--secondary-color);
      margin-bottom: 25px;
      text-align: center;
    }

    /* Seções */
    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: var(--primary-color);
      margin-bottom: 15px;
      padding-left: 10px;
      border-left: 4px solid var(--accent-color);
    }

    /* Cards de resumo */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }

    .summary-card .number {
      font-size: 28px;
      font-weight: bold;
      color: var(--primary-color);
      display: block;
    }

    .summary-card .label {
      font-size: 11px;
      color: var(--secondary-color);
      margin-top: 4px;
    }

    /* Tabelas */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
    }

    .data-table th {
      background: var(--primary-color);
      color: white;
      padding: 10px 8px;
      text-align: left;
      font-weight: bold;
    }

    .data-table td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }

    .data-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .data-table tr:hover {
      background: #f1f5f9;
    }

    /* Prioridades */
    .priority {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .priority.urgent {
      background: #fecaca;
      color: #dc2626;
    }

    .priority.high {
      background: #fed7aa;
      color: #ea580c;
    }

    .priority.medium {
      background: #fef3c7;
      color: #d97706;
    }

    .priority.low {
      background: #dcfce7;
      color: #16a34a;
    }

    /* Status */
    .status-active { color: #16a34a; font-weight: bold; }
    .status-suspended { color: #dc2626; }
    .status-concluded { color: var(--secondary-color); }

    /* Insights */
    .insights {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }

    .insights h4 {
      color: #0369a1;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .insights ul {
      list-style: none;
      padding: 0;
    }

    .insights li {
      padding: 4px 0;
      position: relative;
      padding-left: 15px;
      font-size: 11px;
    }

    .insights li:before {
      content: "→";
      position: absolute;
      left: 0;
      color: #0ea5e9;
      font-weight: bold;
    }

    /* Footer */
    .footer {
      position: fixed;
      bottom: 15mm;
      left: 20mm;
      right: 20mm;
      height: 15mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: var(--secondary-color);
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }

    /* Quebras de página */
    .page-break {
      page-break-before: always;
    }

    /* Watermark */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 48px;
      color: rgba(0, 0, 0, 0.05);
      z-index: -1;
      pointer-events: none;
    }

    /* Charts container */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }

    .chart-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }

    /* Print optimizations */
    @media print {
      .page {
        margin: 0;
        box-shadow: none;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }

    /* Responsive para preview */
    @media screen and (max-width: 768px) {
      .page {
        width: 100%;
        padding: 15px;
      }

      .summary-cards {
        grid-template-columns: repeat(2, 1fr);
      }

      .data-table {
        font-size: 10px;
      }
    }
  </style>
`;

// ================================
// GERADOR DE CSS PERSONALIZADO
// ================================

export function generateCustomCSS(customization: ReportCustomization): string {
  return `
    <style>
      :root {
        --primary-color: ${customization.primary_color};
        --secondary-color: ${customization.secondary_color};
        --accent-color: ${customization.accent_color};
      }

      ${customization.watermark ? `
        .watermark:after {
          content: "${customization.watermark}";
        }
      ` : ''}
    </style>
  `;
}

// ================================
// TEMPLATE COMPLETO
// ================================

export function generateCompleteReportTemplate(
  data: ReportData,
  customization: ReportCustomization
): string {
  const customCSS = generateCustomCSS(customization);
  const formatDate = (date: Date) => date.toLocaleDateString('pt-BR');
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.title} - Relatório Completo</title>
      ${BASE_STYLES}
      ${customCSS}
    </head>
    <body>
      ${customization.watermark ? '<div class="watermark"></div>' : ''}

      <div class="page">
        <!-- Header -->
        <header class="header">
          <div class="header-left">
            ${customization.client_logo ?
              `<img src="${customization.client_logo}" alt="Logo" class="client-logo">` : ''
            }
            <div class="company-info">
              <h1>${customization.company_name}</h1>
              ${customization.company_address ?
                `<p>${customization.company_address}</p>` : ''
              }
            </div>
          </div>
          <div class="header-right">
            <div class="report-meta">
              <strong>Gerado em:</strong> ${formatDate(data.generated_at)}<br>
              <strong>Por:</strong> ${data.generated_by}<br>
              <strong>Workspace:</strong> ${data.workspace_name}
            </div>
          </div>
        </header>

        <!-- Título -->
        <h1 class="report-title">${data.title}</h1>
        ${data.subtitle ? `<p class="report-subtitle">${data.subtitle}</p>` : ''}

        <!-- Resumo Executivo -->
        <section class="section">
          <h2 class="section-title">Resumo Executivo</h2>

          <div class="summary-cards">
            <div class="summary-card">
              <span class="number">${data.summary.total_processes}</span>
              <div class="label">Total de Processos</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.active_processes}</span>
              <div class="label">Processos Ativos</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.new_movements}</span>
              <div class="label">Novas Movimentações</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.critical_alerts}</span>
              <div class="label">Alertas Críticos</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.pending_actions}</span>
              <div class="label">Ações Pendentes</div>
            </div>
          </div>
        </section>

        <!-- Insights IA -->
        ${data.insights && data.insights.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Insights da Inteligência Artificial</h2>
          <div class="insights">
            <h4>Principais Observações:</h4>
            <ul>
              ${data.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        </section>
        ` : ''}
      </div>

      <!-- Nova página para processos -->
      <div class="page page-break">
        <section class="section">
          <h2 class="section-title">Detalhamento dos Processos</h2>

          <table class="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Assunto</th>
                <th>Tribunal</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Última Movimentação</th>
                <th>Próximo Prazo</th>
              </tr>
            </thead>
            <tbody>
              ${data.processes.map(process => `
                <tr>
                  <td><strong>${process.number}</strong></td>
                  <td>${process.client_name}</td>
                  <td>${process.subject}</td>
                  <td>${process.court}</td>
                  <td><span class="status-${process.status.toLowerCase()}">${process.status}</span></td>
                  <td><span class="priority ${process.priority.toLowerCase()}">${process.priority}</span></td>
                  <td>
                    ${process.last_movement ? `
                      <strong>${formatDate(process.last_movement.date)}</strong><br>
                      <small>${process.last_movement.description.substring(0, 100)}...</small>
                    ` : 'Sem movimentações'}
                  </td>
                  <td>
                    ${process.next_deadline ? formatDate(process.next_deadline) : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>

        <!-- Análises Financeiras -->
        <section class="section">
          <h2 class="section-title">Análise Financeira</h2>

          <table class="data-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Cliente</th>
                <th>Valor da Causa</th>
                <th>Custos Incorridos</th>
                <th>Duração Estimada</th>
              </tr>
            </thead>
            <tbody>
              ${data.processes
                .filter(p => p.financial_info)
                .map(process => `
                  <tr>
                    <td>${process.number}</td>
                    <td>${process.client_name}</td>
                    <td>
                      ${process.financial_info?.case_value ?
                        formatCurrency(process.financial_info.case_value) : '-'
                      }
                    </td>
                    <td>
                      ${process.financial_info?.costs_incurred ?
                        formatCurrency(process.financial_info.costs_incurred) : '-'
                      }
                    </td>
                    <td>${process.financial_info?.estimated_duration || '-'}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </section>
      </div>

      <!-- Footer -->
      <footer class="footer">
        <div>
          ${customization.footer_text || `${customization.company_name} - Sistema JustoAI`}
        </div>
        <div>
          ${customization.show_page_numbers ? 'Página <span class="pageNumber"></span> de <span class="totalPages"></span>' : ''}
        </div>
      </footer>
    </body>
    </html>
  `;
}

// ================================
// TEMPLATE DE NOVIDADES
// ================================

export function generateUpdatesReportTemplate(
  data: ReportData,
  customization: ReportCustomization,
  daysFilter: number = 7
): string {
  const customCSS = generateCustomCSS(customization);
  const formatDate = (date: Date) => date.toLocaleDateString('pt-BR');
  const formatDateTime = (date: Date) => date.toLocaleString('pt-BR');

  // Filtrar apenas processos com movimentações recentes
  const recentProcesses = data.processes.filter(process =>
    process.recent_movements &&
    process.recent_movements.some(movement =>
      (new Date().getTime() - movement.date.getTime()) / (1000 * 60 * 60 * 24) <= daysFilter
    )
  );

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.title} - Novidades (${daysFilter} dias)</title>
      ${BASE_STYLES}
      ${customCSS}
    </head>
    <body>
      ${customization.watermark ? '<div class="watermark"></div>' : ''}

      <div class="page">
        <!-- Header -->
        <header class="header">
          <div class="header-left">
            ${customization.client_logo ?
              `<img src="${customization.client_logo}" alt="Logo" class="client-logo">` : ''
            }
            <div class="company-info">
              <h1>${customization.company_name}</h1>
              ${customization.company_address ?
                `<p>${customization.company_address}</p>` : ''
              }
            </div>
          </div>
          <div class="header-right">
            <div class="report-meta">
              <strong>Período:</strong> Últimos ${daysFilter} dias<br>
              <strong>Gerado em:</strong> ${formatDate(data.generated_at)}<br>
              <strong>Por:</strong> ${data.generated_by}
            </div>
          </div>
        </header>

        <!-- Título -->
        <h1 class="report-title">Relatório de Novidades</h1>
        <p class="report-subtitle">Movimentações dos últimos ${daysFilter} dias</p>

        <!-- Resumo das Novidades -->
        <section class="section">
          <h2 class="section-title">Resumo das Novidades</h2>

          <div class="summary-cards">
            <div class="summary-card">
              <span class="number">${recentProcesses.length}</span>
              <div class="label">Processos com Novidades</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.new_movements}</span>
              <div class="label">Novas Movimentações</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.critical_alerts}</span>
              <div class="label">Alertas Críticos</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.pending_actions}</span>
              <div class="label">Ações Requeridas</div>
            </div>
          </div>
        </section>

        <!-- Processos com Novidades -->
        <section class="section">
          <h2 class="section-title">Processos com Movimentações Recentes</h2>

          ${recentProcesses.map(process => `
            <div style="margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="color: var(--primary-color); margin: 0;">
                  ${process.number} - ${process.client_name}
                </h3>
                <span class="priority ${process.priority.toLowerCase()}">${process.priority}</span>
              </div>

              <p style="margin-bottom: 10px; font-size: 11px; color: var(--secondary-color);">
                <strong>Assunto:</strong> ${process.subject} |
                <strong>Tribunal:</strong> ${process.court}
              </p>

              <!-- Movimentações Recentes -->
              ${process.recent_movements ? `
                <h4 style="font-size: 13px; margin-bottom: 8px; color: var(--primary-color);">
                  Movimentações Recentes:
                </h4>
                <div style="background: #f8fafc; padding: 10px; border-radius: 6px;">
                  ${process.recent_movements
                    .filter(movement =>
                      (new Date().getTime() - movement.date.getTime()) / (1000 * 60 * 60 * 24) <= daysFilter
                    )
                    .map(movement => `
                      <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">
                        <strong style="color: var(--accent-color);">
                          ${formatDateTime(movement.date)}
                        </strong>
                        <span style="margin-left: 10px; padding: 2px 6px; background: #ddd6fe; color: #7c3aed; border-radius: 4px; font-size: 9px;">
                          ${movement.type}
                        </span>
                        <br>
                        <small style="color: var(--secondary-color); line-height: 1.3;">
                          ${movement.description}
                        </small>
                      </div>
                    `).join('')}
                </div>
              ` : ''}

              <!-- AI Insights -->
              ${process.ai_insights && process.ai_insights.length > 0 ? `
                <div class="insights" style="margin-top: 10px;">
                  <h4>Análise de IA:</h4>
                  <ul>
                    ${process.ai_insights.map(insight => `<li>${insight}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </section>
      </div>

      <!-- Footer -->
      <footer class="footer">
        <div>
          ${customization.footer_text || `${customization.company_name} - Sistema JustoAI`}
        </div>
        <div>
          ${customization.show_page_numbers ? 'Página <span class="pageNumber"></span> de <span class="totalPages"></span>' : ''}
        </div>
      </footer>
    </body>
    </html>
  `;
}

// ================================
// TEMPLATE EXECUTIVO (RESUMIDO)
// ================================

export function generateExecutiveReportTemplate(
  data: ReportData,
  customization: ReportCustomization
): string {
  const customCSS = generateCustomCSS(customization);
  const formatDate = (date: Date) => date.toLocaleDateString('pt-BR');

  // Processos críticos (apenas alta prioridade)
  const criticalProcesses = data.processes.filter(p =>
    p.priority === 'HIGH' || p.priority === 'URGENT'
  );

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.title} - Resumo Executivo</title>
      ${BASE_STYLES}
      ${customCSS}
    </head>
    <body>
      ${customization.watermark ? '<div class="watermark"></div>' : ''}

      <div class="page">
        <!-- Header -->
        <header class="header">
          <div class="header-left">
            ${customization.client_logo ?
              `<img src="${customization.client_logo}" alt="Logo" class="client-logo">` : ''
            }
            <div class="company-info">
              <h1>${customization.company_name}</h1>
              ${customization.company_address ?
                `<p>${customization.company_address}</p>` : ''
              }
            </div>
          </div>
          <div class="header-right">
            <div class="report-meta">
              <strong>Resumo Executivo</strong><br>
              <strong>Gerado em:</strong> ${formatDate(data.generated_at)}<br>
              <strong>Por:</strong> ${data.generated_by}
            </div>
          </div>
        </header>

        <!-- Título -->
        <h1 class="report-title">Resumo Executivo</h1>
        <p class="report-subtitle">Visão geral dos processos jurídicos</p>

        <!-- KPIs Principais -->
        <section class="section">
          <div class="summary-cards">
            <div class="summary-card">
              <span class="number">${data.summary.total_processes}</span>
              <div class="label">Total de Processos</div>
            </div>
            <div class="summary-card">
              <span class="number">${criticalProcesses.length}</span>
              <div class="label">Processos Críticos</div>
            </div>
            <div class="summary-card">
              <span class="number">${data.summary.pending_actions}</span>
              <div class="label">Ações Pendentes</div>
            </div>
          </div>
        </section>

        <!-- Processos que Requerem Atenção -->
        <section class="section">
          <h2 class="section-title">Processos que Requerem Atenção Imediata</h2>

          <table class="data-table">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Cliente</th>
                <th>Prioridade</th>
                <th>Última Movimentação</th>
                <th>Próximo Prazo</th>
              </tr>
            </thead>
            <tbody>
              ${criticalProcesses.slice(0, 10).map(process => `
                <tr>
                  <td><strong>${process.number}</strong></td>
                  <td>${process.client_name}</td>
                  <td><span class="priority ${process.priority.toLowerCase()}">${process.priority}</span></td>
                  <td>
                    ${process.last_movement ?
                      formatDate(process.last_movement.date) : 'Sem movimentações'
                    }
                  </td>
                  <td>
                    ${process.next_deadline ? formatDate(process.next_deadline) : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>

        <!-- Insights IA -->
        ${data.insights && data.insights.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Principais Insights</h2>
          <div class="insights">
            <ul>
              ${data.insights.slice(0, 5).map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        </section>
        ` : ''}
      </div>

      <!-- Footer -->
      <footer class="footer">
        <div>
          ${customization.footer_text || `${customization.company_name} - Sistema JustoAI`}
        </div>
        <div>
          ${customization.show_page_numbers ? 'Página <span class="pageNumber"></span> de <span class="totalPages"></span>' : ''}
        </div>
      </footer>
    </body>
    </html>
  `;
}

// ================================
// SELETOR DE TEMPLATE
// ================================

export function generateReportTemplate(
  type: ReportType,
  data: ReportData,
  customization: ReportCustomization,
  options?: { daysFilter?: number }
): string {
  switch (type) {
    case 'complete':
      return generateCompleteReportTemplate(data, customization);

    case 'updates':
      return generateUpdatesReportTemplate(
        data,
        customization,
        options?.daysFilter || 7
      );

    case 'executive':
      return generateExecutiveReportTemplate(data, customization);

    default:
      throw new Error(`Tipo de relatório não suportado: ${type}`);
  }
}