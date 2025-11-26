// ================================================================
// MOTOR DE TEMPLATES DOCX - Geração Profissional Microsoft Word
// ================================================================

import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, Header, Footer, PageNumber, NumberFormat } from 'docx';
import { ICONS } from '@/lib/icons';
import fs from 'fs/promises';
import path from 'path';
import { log, logError } from '@/lib/services/logger';

// Interfaces para o template engine DOCX
export interface DOCXTemplateOptions {
  reportType: 'JURIDICO' | 'EXECUTIVO';
  audienceType: 'CLIENTE' | 'DIRETORIA' | 'USO_INTERNO';
  customization?: DOCXCustomization;
  metadata?: {
    workspaceName: string;
    generatedAt: Date;
    generatedBy: string;
    processCount: number;
  };
}

export interface DOCXCustomization {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerText?: string;
  footerText?: string;
  showPageNumbers: boolean;
  showGeneratedBy: boolean;
  watermark?: string;
  logoPath?: string;
}

export interface DOCXGenerationResult {
  success: boolean;
  filePath: string;
  fileSize: number;
  processingTime: number;
  error?: string;
}

export interface ProcessData {
  id: string;
  number: string;
  client: {
    name: string;
    type: string;
  };
  status: string;
  lastMovement?: {
    date: Date;
    description: string;
  };
  movements: Array<{
    date: Date;
    description: string;
    type: string;
  }>;
  summary?: string;
}

export class DOCXTemplateEngine {
  /**
   * Gera documento DOCX a partir do conteúdo e dados
   */
  async generateDOCX(
    content: string,
    processData: ProcessData[],
    options: DOCXTemplateOptions,
    outputPath: string
  ): Promise<DOCXGenerationResult> {
    const startTime = Date.now();

    try {
      log.info({ msg: 'Generating DOCX:' });

      const customization = options.customization || this.getDefaultCustomization();

      // Criar documento
      const doc = new Document({
        creator: 'JustoAI',
        title: this.getDocumentTitle(options),
        description: `Relatório ${options.reportType} gerado automaticamente`,
        styles: this.generateStyles(customization),
        numbering: this.generateNumbering(),
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440, // 1 inch = 1440 twips
                  right: 1080,
                  bottom: 1440,
                  left: 1080,
                },
              },
            },
            headers: {
              default: this.generateHeader(options, customization),
            },
            footers: {
              default: this.generateFooter(options, customization),
            },
            children: [
              // Capa
              ...this.generateCoverPage(options, customization),

              // Página break
              new Paragraph({
                children: [],
                pageBreakBefore: true,
              }),

              // Sumário executivo
              ...this.generateExecutiveSummary(processData, options),

              // Conteúdo principal
              ...this.generateMainContent(content, processData, options),

              // Estatísticas
              ...this.generateStatistics(processData, options),

              // Recomendações
              ...this.generateRecommendations(processData, options),
            ],
          },
        ],
      });

      // Gerar buffer
      const buffer = await Packer.toBuffer(doc);

      // Salvar arquivo
      await fs.writeFile(outputPath, buffer);

      // Verificar arquivo gerado
      const stats = await fs.stat(outputPath);
      const fileSize = stats.size;

      log.info({ msg: 'DOCX generated successfully:  bytes' });

      return {
        success: true,
        filePath: outputPath,
        fileSize,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logError(_error, '${ICONS.ERROR} DOCX generation failed:', { component: 'refactored' });
      return {
        success: false,
        filePath: '',
        fileSize: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gera estilos do documento
   */
  private generateStyles(customization: DOCXCustomization): Record<string, unknown> {
    const primaryColorHex = customization.primaryColor.replace('#', '');
    const accentColorHex = customization.accentColor.replace('#', '');

    return {
      paragraphStyles: [
        {
          id: 'DocumentTitle',
          name: 'Document Title',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 32,
            bold: true,
            color: primaryColorHex,
            font: 'Segoe UI',
          },
          paragraph: {
            alignment: 'center' as const,
            spacing: {
              after: 400,
            },
          },
        },
        {
          id: 'SectionTitle',
          name: 'Section Title',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 24,
            bold: true,
            color: primaryColorHex,
            font: 'Segoe UI',
          },
          paragraph: {
            spacing: {
              before: 400,
              after: 200,
            },
            border: {
              bottom: {
                color: accentColorHex,
                space: 1,
                style: 'single' as const,
                size: 6,
              },
            },
          },
        },
        {
          id: 'ProcessTitle',
          name: 'Process Title',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 20,
            bold: true,
            color: primaryColorHex,
            font: 'Segoe UI',
          },
          paragraph: {
            spacing: {
              before: 300,
              after: 100,
            },
          },
        },
        {
          id: 'HighlightBox',
          name: 'Highlight Box',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 22,
            font: 'Segoe UI',
          },
          paragraph: {
            spacing: {
              before: 200,
              after: 200,
            },
            shading: {
              type: 'clear' as const,
              color: accentColorHex + '20', // 20% opacity
            },
            border: {
              left: {
                color: accentColorHex,
                space: 4,
                style: 'single' as const,
                size: 12,
              },
            },
          },
        },
      ],
    };
  }

  /**
   * Gera numeração para listas
   */
  private generateNumbering() {
    return {
      config: [
        {
          reference: 'bulletList',
          levels: [
            {
              level: 0,
              format: NumberFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: 720,
                    hanging: 360,
                  },
                },
              },
            },
          ],
        },
        {
          reference: 'numberedList',
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: 720,
                    hanging: 360,
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  /**
   * Gera header do documento
   */
  private generateHeader(options: DOCXTemplateOptions, customization: DOCXCustomization) {
    return new Header({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: customization.headerText || `${customization.companyName} - ${this.getDocumentTitle(options)}`,
              size: 18,
              color: customization.secondaryColor.replace('#', ''),
            }),
          ],
          alignment: AlignmentType.RIGHT,
        }),
      ],
    });
  }

  /**
   * Gera footer do documento
   */
  private generateFooter(options: DOCXTemplateOptions, customization: DOCXCustomization) {
    const footerElements = [];

    if (customization.showGeneratedBy) {
      footerElements.push(
        new TextRun({
          text: `Gerado pela JustoAI em ${new Date().toLocaleDateString('pt-BR')}`,
          size: 16,
          color: customization.secondaryColor.replace('#', ''),
        })
      );
    }

    if (customization.showPageNumbers) {
      if (footerElements.length > 0) {
        footerElements.push(new TextRun({ text: ' | ' }));
      }
      footerElements.push(
        new TextRun({ text: 'Página ' }),
        new TextRun({
          children: [PageNumber.CURRENT]
        })
      );
    }

    return new Footer({
      children: [
        new Paragraph({
          children: footerElements,
          alignment: AlignmentType.CENTER,
        }),
      ],
    });
  }

  /**
   * Gera página de capa
   */
  private generateCoverPage(options: DOCXTemplateOptions, customization: DOCXCustomization): Paragraph[] {
    const date = new Date().toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return [
      // Título principal
      new Paragraph({
        children: [
          new TextRun({
            text: customization.companyName,
            size: 36,
            bold: true,
            color: customization.primaryColor.replace('#', ''),
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      // Subtítulo
      new Paragraph({
        children: [
          new TextRun({
            text: this.getDocumentTitle(options),
            size: 28,
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),

      // Tipo de audiência
      new Paragraph({
        children: [
          new TextRun({
            text: this.getAudienceDescription(options.audienceType),
            size: 20,
            color: customization.secondaryColor.replace('#', ''),
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      }),

      // Data
      new Paragraph({
        children: [
          new TextRun({
            text: date,
            size: 24,
            bold: true,
            color: customization.accentColor.replace('#', ''),
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      // Informações do relatório
      new Paragraph({
        children: [
          new TextRun({
            text: `Relatório gerado automaticamente pela plataforma JustoAI`,
            size: 16,
            italics: true,
            color: customization.secondaryColor.replace('#', ''),
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ];
  }

  /**
   * Gera sumário executivo
   */
  private generateExecutiveSummary(processData: ProcessData[], options: DOCXTemplateOptions): Paragraph[] {
    const totalProcesses = processData.length;
    const activeProcesses = processData.filter(p => p.status === 'ACTIVE').length;
    const recentMovements = processData.reduce((sum, p) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sum + p.movements.filter(m => m.date >= sevenDaysAgo).length;
    }, 0);

    return [
      new Paragraph({
        text: 'Sumário Executivo',
        style: 'SectionTitle',
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: `Este relatório apresenta uma análise ${options.reportType === 'JURIDICO' ? 'técnica e detalhada' : 'executiva e estratégica'} de ${totalProcesses} processos jurídicos monitorados.`,
            size: 22,
          }),
        ],
        spacing: { after: 200 },
        style: 'HighlightBox',
      }),

      new Paragraph({
        children: [
          new TextRun({ text: 'Principais indicadores:', bold: true, size: 20 }),
        ],
        spacing: { before: 200, after: 100 },
      }),

      new Paragraph({
        children: [
          new TextRun({ text: '• ', bold: true }),
          new TextRun({ text: `Total de processos: ${totalProcesses}` }),
        ],
        numbering: { reference: 'bulletList', level: 0 },
      }),

      new Paragraph({
        children: [
          new TextRun({ text: '• ', bold: true }),
          new TextRun({ text: `Processos ativos: ${activeProcesses}` }),
        ],
        numbering: { reference: 'bulletList', level: 0 },
      }),

      new Paragraph({
        children: [
          new TextRun({ text: '• ', bold: true }),
          new TextRun({ text: `Movimentações recentes (7 dias): ${recentMovements}` }),
        ],
        numbering: { reference: 'bulletList', level: 0 },
      }),
    ];
  }

  /**
   * Gera conteúdo principal
   */
  private generateMainContent(content: string, processData: ProcessData[], options: DOCXTemplateOptions): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Título da seção
    paragraphs.push(
      new Paragraph({
        text: options.reportType === 'JURIDICO' ? 'Análise Detalhada dos Processos' : 'Situação Atual dos Processos',
        style: 'SectionTitle',
      })
    );

    // Processar cada processo
    for (const process of processData) {
      paragraphs.push(
        // Título do processo
        new Paragraph({
          text: `Processo ${process.number}`,
          style: 'ProcessTitle',
        }),

        // Informações do cliente
        new Paragraph({
          children: [
            new TextRun({ text: 'Cliente: ', bold: true }),
            new TextRun({ text: process.client.name }),
            new TextRun({ text: ' | Status: ', bold: true }),
            new TextRun({ text: process.status }),
          ],
          spacing: { after: 100 },
        })
      );

      // Última movimentação
      if (process.lastMovement) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Última movimentação: ', bold: true }),
              new TextRun({ text: process.lastMovement.date.toLocaleDateString('pt-BR') }),
            ],
            spacing: { after: 100 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: process.lastMovement.description }),
            ],
            spacing: { after: 200 },
          })
        );
      }

      // Movimentações recentes (apenas para relatório jurídico)
      if (options.reportType === 'JURIDICO' && process.movements.length > 0) {
        paragraphs.push(
          new Paragraph({
            text: 'Movimentações Recentes:',
            run: { bold: true },
            spacing: { before: 100, after: 100 },
          })
        );

        const recentMovements = process.movements.slice(0, 5); // Últimas 5
        for (const movement of recentMovements) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${movement.date.toLocaleDateString('pt-BR')}: `,
                  bold: true,
                  size: 18,
                }),
                new TextRun({
                  text: movement.description,
                  size: 18,
                }),
              ],
              numbering: { reference: 'bulletList', level: 0 },
            })
          );
        }
      }

      // Separador entre processos
      paragraphs.push(
        new Paragraph({
          children: [],
          spacing: { after: 400 },
        })
      );
    }

    return paragraphs;
  }

  /**
   * Gera seção de estatísticas
   */
  private generateStatistics(processData: ProcessData[], _options: DOCXTemplateOptions): Paragraph[] {
    const statusStats = this.calculateStatusStats(processData);

    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: 'Estatísticas Gerais',
        style: 'SectionTitle',
      }),
    ];

    // Criar tabela de estatísticas
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Indicador', run: { bold: true } })],
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Valor', run: { bold: true } })],
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
    ];

    // Adicionar estatísticas à tabela
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Total de Processos')] }),
          new TableCell({ children: [new Paragraph(processData.length.toString())] }),
        ],
      })
    );

    Object.entries(statusStats).forEach(([status, count]) => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`Status: ${status}`)] }),
            new TableCell({ children: [new Paragraph(count.toString())] }),
          ],
        })
      );
    });

    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    paragraphs.push(
      new Paragraph({
        children: [table],
        spacing: { before: 200, after: 400 },
      })
    );

    return paragraphs;
  }

  /**
   * Gera seção de recomendações
   */
  private generateRecommendations(processData: ProcessData[], options: DOCXTemplateOptions): Paragraph[] {
    const urgentCount = processData.filter(p =>
      p.movements.some(m => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        return m.date >= threeDaysAgo;
      })
    ).length;

    return [
      new Paragraph({
        text: options.audienceType === 'CLIENTE' ? 'Próximos Passos' : 'Recomendações',
        style: 'SectionTitle',
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: options.audienceType === 'CLIENTE'
              ? 'Com base na análise dos seus processos, recomendamos:'
              : 'Baseado na análise técnica dos processos, sugerimos:',
            size: 20,
          }),
        ],
        spacing: { after: 200 },
      }),

      new Paragraph({
        children: [
          new TextRun({ text: '1. ' }),
          new TextRun({
            text: urgentCount > 0
              ? `Atenção prioritária aos ${urgentCount} processos com movimentações recentes`
              : 'Manter acompanhamento regular dos processos ativos'
          }),
        ],
        numbering: { reference: 'numberedList', level: 0 },
      }),

      new Paragraph({
        children: [
          new TextRun({ text: '2. ' }),
          new TextRun({
            text: options.audienceType === 'CLIENTE'
              ? 'Manter documentação atualizada e disponível'
              : 'Revisar estratégias processuais dos casos prioritários'
          }),
        ],
        numbering: { reference: 'numberedList', level: 0 },
      }),

      new Paragraph({
        children: [
          new TextRun({ text: '3. ' }),
          new TextRun({
            text: options.audienceType === 'CLIENTE'
              ? 'Contatar o escritório para esclarecimentos ou dúvidas'
              : 'Atualizar cronograma de ações e prazos críticos'
          }),
        ],
        numbering: { reference: 'numberedList', level: 0 },
      }),
    ];
  }

  /**
   * Calcula estatísticas por status
   */
  private calculateStatusStats(processData: ProcessData[]): Record<string, number> {
    const stats: Record<string, number> = {};
    processData.forEach(process => {
      stats[process.status] = (stats[process.status] || 0) + 1;
    });
    return stats;
  }

  /**
   * Retorna título do documento
   */
  private getDocumentTitle(options: DOCXTemplateOptions): string {
    const typeMap = {
      'JURIDICO': 'Relatório Jurídico Detalhado',
      'EXECUTIVO': 'Relatório Executivo'
    };

    return typeMap[options.reportType] || 'Relatório Personalizado';
  }

  /**
   * Retorna descrição da audiência
   */
  private getAudienceDescription(audienceType: string): string {
    const audienceMap: { [key: string]: string } = {
      'CLIENTE': 'Relatório para Cliente',
      'DIRETORIA': 'Resumo Executivo para Diretoria',
      'USO_INTERNO': 'Relatório Técnico Interno'
    };

    return audienceMap[audienceType] || 'Relatório Personalizado';
  }

  /**
   * Retorna customização padrão
   */
  private getDefaultCustomization(): DOCXCustomization {
    return {
      companyName: 'JustoAI',
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      accentColor: '#10b981',
      showPageNumbers: true,
      showGeneratedBy: true
    };
  }
}

// Singleton para reutilização
let docxEngine: DOCXTemplateEngine | null = null;

export function getDOCXTemplateEngine(): DOCXTemplateEngine {
  if (!docxEngine) {
    docxEngine = new DOCXTemplateEngine();
  }
  return docxEngine;
}