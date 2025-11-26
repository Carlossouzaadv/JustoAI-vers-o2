// ================================================================
// MOTOR DE TEMPLATES PDF - Geração Profissional
// ================================================================

import puppeteer, { Browser, PDFOptions } from 'puppeteer';
import { ICONS } from '@/lib/icons';
import path from 'path';
import fs from 'fs/promises';
import { log, logError } from '@/lib/services/logger';

// Interfaces para o template engine
export interface PDFTemplateOptions {
  reportType: 'JURIDICO' | 'EXECUTIVO';
  audienceType: 'CLIENTE' | 'DIRETORIA' | 'USO_INTERNO';
  customization?: ReportCustomization;
  metadata?: {
    workspaceName: string;
    generatedAt: Date;
    generatedBy: string;
    processCount: number;
  };
}

export interface ReportCustomization {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  logoBase64?: string;
  headerText?: string;
  footerText?: string;
  showPageNumbers: boolean;
  showGeneratedBy: boolean;
  watermark?: string;
  watermarkOpacity?: number;
}

export interface PDFGenerationResult {
  success: boolean;
  filePath: string;
  fileSize: number;
  pageCount: number;
  processingTime: number;
  error?: string;
}

export class PDFTemplateEngine {
  private browser: Browser | null = null;

  /**
   * Inicializa o browser Puppeteer
   */
  async initialize(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      log.info({ msg: 'PDF Template Engine initialized' });
    } catch (error) {
      logError(_error, '${ICONS.ERROR} Failed to initialize PDF engine:', { component: 'refactored' });
      throw error;
    }
  }

  /**
   * Gera PDF a partir de conteúdo HTML
   */
  async generatePDF(
    htmlContent: string,
    options: PDFTemplateOptions,
    outputPath: string
  ): Promise<PDFGenerationResult> {
    const startTime = Date.now();

    try {
      if (!this.browser) {
        await this.initialize();
      }

      log.info({ msg: 'Generating PDF:' });

      // Criar página
      const page = await this.browser!.newPage();

      // Aplicar template HTML completo
      const templatedHTML = await this.applyTemplate(htmlContent, options);

      // Configurar viewport
      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2
      });

      // Carregar conteúdo
      await page.setContent(templatedHTML, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Configurações do PDF
      const pdfOptions: PDFOptions = {
        path: outputPath,
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: this.generateHeaderTemplate(options),
        footerTemplate: this.generateFooterTemplate(options)
      };

      // Gerar PDF
      await page.pdf(pdfOptions);
      await page.close();

      // Verificar arquivo gerado
      const stats = await fs.stat(outputPath);
      const fileSize = stats.size;

      // Estimar número de páginas (aproximação)
      const pageCount = Math.max(1, Math.ceil(fileSize / 50000)); // ~50KB por página

      log.info({ msg: 'PDF generated successfully:  bytes, ~ pages' });

      return {
        success: true,
        filePath: outputPath,
        fileSize,
        pageCount,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logError(_error, '${ICONS.ERROR} PDF generation failed:', { component: 'refactored' });
      return {
        success: false,
        filePath: '',
        fileSize: 0,
        pageCount: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Aplica template HTML completo
   */
  private async applyTemplate(content: string, options: PDFTemplateOptions): Promise<string> {
    const customization = options.customization || this.getDefaultCustomization();

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório ${options.reportType} - JustoAI</title>
    <style>
        ${this.generateCSS(customization, options)}
    </style>
</head>
<body>
    <div class="document-container">
        ${this.generateWatermark(customization)}

        <header class="document-header">
            ${this.generateLogoSection(customization)}
            <div class="header-content">
                <h1 class="document-title">${this.getDocumentTitle(options)}</h1>
                <div class="document-subtitle">${this.getDocumentSubtitle(options)}</div>
            </div>
            ${customization.headerText ? `<div class="custom-header">${customization.headerText}</div>` : ''}
        </header>

        <main class="document-content">
            ${this.processContent(content, options)}
        </main>

        <footer class="document-footer">
            ${customization.footerText || this.getDefaultFooter()}
        </footer>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Gera CSS customizado
   */
  private generateCSS(customization: ReportCustomization, options: PDFTemplateOptions): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background: white;
        }

        .document-container {
            position: relative;
            width: 100%;
            min-height: 100vh;
        }

        /* Header */
        .document-header {
            padding: 20px 0;
            margin-bottom: 30px;
            border-bottom: 3px solid ${customization.primaryColor};
            position: relative;
        }

        .logo-section {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }

        .logo {
            max-width: 120px;
            max-height: 60px;
            margin-right: 20px;
        }

        .company-info h2 {
            color: ${customization.primaryColor};
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
        }

        .company-info p {
            color: ${customization.secondaryColor};
            font-size: 14px;
        }

        .document-title {
            font-size: 28px;
            font-weight: 700;
            color: ${customization.primaryColor};
            margin-bottom: 10px;
            text-align: center;
        }

        .document-subtitle {
            font-size: 16px;
            color: ${customization.secondaryColor};
            text-align: center;
            font-weight: 300;
        }

        .custom-header {
            margin-top: 15px;
            padding: 10px;
            background: ${customization.primaryColor}15;
            border-radius: 5px;
            font-size: 14px;
        }

        /* Content */
        .document-content {
            margin-bottom: 40px;
        }

        .content-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }

        .section-title {
            font-size: 20px;
            font-weight: 600;
            color: ${customization.primaryColor};
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid ${customization.accentColor};
        }

        .section-content {
            padding-left: 20px;
        }

        .summary-box {
            background: ${customization.accentColor}15;
            border-left: 4px solid ${customization.accentColor};
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }

        .process-item {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }

        .process-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .process-number {
            font-size: 18px;
            font-weight: 600;
            color: ${customization.primaryColor};
        }

        .process-status {
            padding: 5px 12px;
            background: ${customization.accentColor};
            color: white;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 500;
        }

        .client-info {
            color: ${customization.secondaryColor};
            font-size: 14px;
            margin-bottom: 10px;
        }

        .movement-list {
            margin-top: 15px;
        }

        .movement-item {
            padding: 10px;
            border-left: 3px solid ${customization.accentColor};
            margin-bottom: 10px;
            background: white;
        }

        .movement-date {
            font-weight: 600;
            color: ${customization.primaryColor};
            font-size: 12px;
        }

        .movement-description {
            color: #34495e;
            margin-top: 5px;
        }

        /* Tables */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        .data-table th {
            background: ${customization.primaryColor};
            color: white;
            font-weight: 600;
        }

        .data-table tr:nth-child(even) {
            background: #f8f9fa;
        }

        /* Statistics */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }

        .stat-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: ${customization.primaryColor};
            display: block;
        }

        .stat-label {
            color: ${customization.secondaryColor};
            font-size: 14px;
            margin-top: 5px;
        }

        /* Footer */
        .document-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 15px 20px;
            background: ${customization.primaryColor}10;
            border-top: 1px solid ${customization.primaryColor}30;
            font-size: 12px;
            color: ${customization.secondaryColor};
        }

        /* Watermark */
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            color: ${customization.primaryColor}${Math.round((customization.watermarkOpacity || 0.05) * 255).toString(16).padStart(2, '0')};
            font-weight: 100;
            z-index: -1;
            pointer-events: none;
            user-select: none;
        }

        /* Page breaks */
        .page-break {
            page-break-before: always;
        }

        /* Utility classes */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 600; }
        .text-primary { color: ${customization.primaryColor}; }
        .text-secondary { color: ${customization.secondaryColor}; }
        .text-accent { color: ${customization.accentColor}; }

        /* Responsive adjustments */
        @media print {
            body { print-color-adjust: exact; }
            .page-break { break-before: page; }
        }

        /* Audience-specific styles */
        ${options.audienceType === 'CLIENTE' ? this.getClienteStyles(customization) : ''}
        ${options.audienceType === 'DIRETORIA' ? this.getDiretoriaStyles(customization) : ''}
        ${options.audienceType === 'USO_INTERNO' ? this.getUsoInternoStyles(customization) : ''}
    `;
  }

  /**
   * Estilos específicos para cliente
   */
  private getClienteStyles(customization: ReportCustomization): string {
    return `
        .client-focus .technical-details { display: none; }
        .client-focus .movement-description { font-size: 14px; }
        .client-focus .summary-box {
            background: ${customization.accentColor}20;
            font-size: 16px;
        }
    `;
  }

  /**
   * Estilos específicos para diretoria
   */
  private getDiretoriaStyles(customization: ReportCustomization): string {
    return `
        .executive-focus .detailed-movements { display: none; }
        .executive-focus .stats-grid { grid-template-columns: repeat(4, 1fr); }
        .executive-focus .stat-card {
            background: ${customization.primaryColor}10;
        }
    `;
  }

  /**
   * Estilos específicos para uso interno
   */
  private getUsoInternoStyles(customization: ReportCustomization): string {
    return `
        .internal-use .process-item {
            border-left: 4px solid ${customization.primaryColor};
        }
        .internal-use .technical-details {
            background: #f1f3f4;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
            font-family: monospace;
            font-size: 12px;
        }
    `;
  }

  /**
   * Gera seção do logo
   */
  private generateLogoSection(customization: ReportCustomization): string {
    const logoHtml = customization.logoUrl || customization.logoBase64
      ? `<img src="${customization.logoUrl || customization.logoBase64}" alt="Logo" class="logo">`
      : '';

    return `
        <div class="logo-section">
            ${logoHtml}
            <div class="company-info">
                <h2>${customization.companyName}</h2>
                <p>Relatório Jurídico Automatizado</p>
            </div>
        </div>
    `;
  }

  /**
   * Gera watermark
   */
  private generateWatermark(customization: ReportCustomization): string {
    if (!customization.watermark) return '';

    return `<div class="watermark">${customization.watermark}</div>`;
  }

  /**
   * Processa conteúdo do relatório
   */
  private processContent(content: string, options: PDFTemplateOptions): string {
    // Converter markdown para HTML se necessário
    let htmlContent = this.markdownToHTML(content);

    // Adicionar classes específicas para audience
    const audienceClass = `${options.audienceType.toLowerCase().replace('_', '-')}-focus`;
    htmlContent = `<div class="${audienceClass}">${htmlContent}</div>`;

    return htmlContent;
  }

  /**
   * Converte markdown básico para HTML
   */
  private markdownToHTML(markdown: string): string {
    return markdown
      .replace(/^# (.*$)/gim, '<h1 class="section-title">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="section-title">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/^\*(.*)\*/gim, '<em>$1</em>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  /**
   * Gera título do documento
   */
  private getDocumentTitle(options: PDFTemplateOptions): string {
    const typeMap = {
      'JURIDICO': 'Relatório Jurídico Detalhado',
      'EXECUTIVO': 'Relatório Executivo'
    };

    return typeMap[options.reportType] || 'Relatório Personalizado';
  }

  /**
   * Gera subtítulo do documento
   */
  private getDocumentSubtitle(options: PDFTemplateOptions): string {
    const audienceMap = {
      'CLIENTE': 'Relatório para Cliente',
      'DIRETORIA': 'Resumo Executivo para Diretoria',
      'USO_INTERNO': 'Relatório Técnico Interno'
    };

    const date = new Date().toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `${audienceMap[options.audienceType]} - ${date}`;
  }

  /**
   * Gera rodapé padrão
   */
  private getDefaultFooter(): string {
    const generateTime = new Date().toLocaleString('pt-BR');

    return `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>Gerado automaticamente pela JustoAI em ${generateTime}</div>
            <div>Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>
        </div>
    `;
  }

  /**
   * Gera template do header para PDF
   */
  private generateHeaderTemplate(options: PDFTemplateOptions): string {
    if (!options.customization?.showPageNumbers) return '<div></div>';

    return `
        <div style="font-size: 10px; color: #666; margin: 0 20px; width: 100%;">
            <div style="text-align: right;">
                ${options.customization?.companyName || 'JustoAI'} - ${this.getDocumentTitle(options)}
            </div>
        </div>
    `;
  }

  /**
   * Gera template do footer para PDF
   */
  private generateFooterTemplate(options: PDFTemplateOptions): string {
    const showPages = options.customization?.showPageNumbers !== false;
    const showGenerated = options.customization?.showGeneratedBy !== false;

    return `
        <div style="font-size: 10px; color: #666; margin: 0 20px; width: 100%; display: flex; justify-content: space-between;">
            <div>
                ${showGenerated ? `Gerado pela JustoAI em ${new Date().toLocaleDateString('pt-BR')}` : ''}
            </div>
            <div>
                ${showPages ? '<span class="pageNumber"></span> / <span class="totalPages"></span>' : ''}
            </div>
        </div>
    `;
  }

  /**
   * Retorna customização padrão
   */
  private getDefaultCustomization(): ReportCustomization {
    return {
      companyName: 'JustoAI',
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      accentColor: '#10b981',
      showPageNumbers: true,
      showGeneratedBy: true,
      watermarkOpacity: 0.05
    };
  }

  /**
   * Fecha o browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      log.info({ msg: 'PDF Template Engine closed' });
    }
  }
}

// Singleton para reutilização
let pdfEngine: PDFTemplateEngine | null = null;

export function getPDFTemplateEngine(): PDFTemplateEngine {
  if (!pdfEngine) {
    pdfEngine = new PDFTemplateEngine();
  }
  return pdfEngine;
}