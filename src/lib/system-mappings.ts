/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// ================================
// MAPEAMENTOS DE SISTEMAS JURÍDICOS
// ================================
// Definições específicas para cada sistema jurídico
// (Projuris, Legal One, Astrea, CP-Pro, etc.)

import { ICONS } from './icons';

// ================================
// TIPOS E INTERFACES
// ================================

export interface SystemMapping {
  system: SourceSystem;
  version: string;
  description: string;
  columnMappings: SystemColumnMapping[];
  transformRules: SystemTransformRule[];
  validationRules: SystemValidationRule[];
  importStrategies: ImportStrategy[];
}

export interface SystemColumnMapping {
  sourceColumn: string | string[]; // Pode ser múltiplas variações
  targetField: string;
  category: 'CASE' | 'CLIENT' | 'EVENT' | 'DOCUMENT' | 'LAWYER' | 'FINANCIAL';
  required: boolean;
  dataType: DataType;
  examples: string[];
  aliases?: string[]; // Nomes alternativos da coluna
}

export interface SystemTransformRule {
  field: string;
  rule: TransformRule;
  conditions?: string[]; // Condições para aplicar a regra
}

export interface SystemValidationRule {
  field: string;
  type: 'REQUIRED' | 'FORMAT' | 'RANGE' | 'UNIQUE' | 'REFERENCE';
  parameters: Record<string, any>;
  errorMessage: string;
}

export interface ImportStrategy {
  name: string;
  description: string;
  order: string[]; // Ordem de importação das categorias
  dependencies: Record<string, string[]>; // Dependências entre entidades
  conflictResolution: 'OVERWRITE' | 'SKIP' | 'MERGE' | 'ASK';
}

export type SourceSystem =
  | 'PROJURIS'
  | 'LEGAL_ONE'
  | 'ASTREA'
  | 'CP_PRO'
  | 'SAJ'
  | 'ESAJ'
  | 'PJE'
  | 'THEMIS'
  | 'ADVBOX'
  | 'UNKNOWN';

export type DataType =
  | 'STRING'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'EMAIL'
  | 'PHONE'
  | 'CURRENCY'
  | 'DOCUMENT'
  | 'ENUM';

export interface TransformRule {
  type: 'DATE_FORMAT' | 'CURRENCY' | 'BOOLEAN' | 'SPLIT' | 'CONCAT' | 'REGEX' | 'LOOKUP' | 'NORMALIZE';
  parameters: Record<string, any>;
  description: string;
}

// ================================
// MAPEAMENTOS ESPECÍFICOS DOS SISTEMAS
// ================================

export class SystemMappings {
  private static mappings: Record<SourceSystem, SystemMapping> = {
    // ================================
    // PROJURIS
    // ================================
    PROJURIS: {
      system: 'PROJURIS',
      version: '1.0',
      description: 'Sistema Projuris - Mapeamento padrão para exportações CSV/Excel',

      columnMappings: [
        // CASOS/PROCESSOS
        {
          sourceColumn: ['Número do Processo', 'NumeroProcesso', 'NumerodeProcesso', 'Processo'],
          targetField: 'process_number',
          category: 'CASE',
          required: true,
          dataType: 'STRING',
          examples: ['1234567-89.2024.1.23.4567', '0001234-56.2024.8.26.0100'],
          aliases: ['num_processo', 'numero_judicial']
        },
        {
          sourceColumn: ['Código da Pasta', 'CodigoPasta', 'CodPasta', 'Pasta'],
          targetField: 'case_code',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['P001234', 'PASTA-2024-001']
        },
        {
          sourceColumn: ['Título do Caso', 'TituloCaso', 'Titulo', 'Assunto'],
          targetField: 'title',
          category: 'CASE',
          required: true,
          dataType: 'STRING',
          examples: ['Ação de Cobrança', 'Divórcio Consensual']
        },
        {
          sourceColumn: ['Comarca', 'Forum', 'Foro'],
          targetField: 'court',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['São Paulo', 'Rio de Janeiro - 1ª Vara Cível']
        },
        {
          sourceColumn: ['Vara', 'Juizo', 'Juízo'],
          targetField: 'court_division',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['1ª Vara Cível', '2ª Vara de Família']
        },
        {
          sourceColumn: ['Instância', 'Instancia', 'Grau'],
          targetField: 'instance',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['1º Grau', '2º Grau', 'Superior']
        },
        {
          sourceColumn: ['Status', 'Situação', 'Situacao', 'StatusProcesso'],
          targetField: 'status',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Ativo', 'Suspenso', 'Arquivado']
        },
        {
          sourceColumn: ['Tipo de Ação', 'TipoAcao', 'Acao', 'Natureza'],
          targetField: 'case_type',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Cível', 'Trabalhista', 'Criminal']
        },
        {
          sourceColumn: ['Valor da Causa', 'ValorCausa', 'ValorDaCausa', 'Valor'],
          targetField: 'claim_value',
          category: 'CASE',
          required: false,
          dataType: 'CURRENCY',
          examples: ['R$ 10.000,00', '50000.50']
        },

        // CLIENTES
        {
          sourceColumn: ['Cliente Nome', 'NomeCliente', 'Cliente', 'Requerente'],
          targetField: 'client_name',
          category: 'CLIENT',
          required: true,
          dataType: 'STRING',
          examples: ['João da Silva Santos', 'Empresa ABC Ltda']
        },
        {
          sourceColumn: ['Código do Cliente', 'CodigoCliente', 'CodCliente', 'ClienteId'],
          targetField: 'client_code',
          category: 'CLIENT',
          required: false,
          dataType: 'STRING',
          examples: ['CLI001', 'C-2024-001']
        },
        {
          sourceColumn: ['CPF/CNPJ', 'CPF', 'CNPJ', 'Documento'],
          targetField: 'document',
          category: 'CLIENT',
          required: false,
          dataType: 'DOCUMENT',
          examples: ['123.456.789-00', '12.345.678/0001-90']
        },
        {
          sourceColumn: ['Email Cliente', 'EmailCliente', 'Email', 'ClienteEmail'],
          targetField: 'email',
          category: 'CLIENT',
          required: false,
          dataType: 'EMAIL',
          examples: ['cliente@email.com', 'contato@empresa.com.br']
        },
        {
          sourceColumn: ['Telefone', 'TelefoneCliente', 'Fone', 'Celular'],
          targetField: 'phone',
          category: 'CLIENT',
          required: false,
          dataType: 'PHONE',
          examples: ['(11) 98765-4321', '11987654321']
        },

        // ADVOGADOS/RESPONSÁVEIS
        {
          sourceColumn: ['Responsável', 'Advogado Responsavel', 'AdvogadoResponsavel', 'Lawyer'],
          targetField: 'responsible_lawyer',
          category: 'LAWYER',
          required: false,
          dataType: 'STRING',
          examples: ['Dr. Maria Silva', 'João Santos - OAB/SP 123456']
        },
        {
          sourceColumn: ['OAB', 'NumeroOAB', 'OABNumero', 'RegistroOAB'],
          targetField: 'oab_number',
          category: 'LAWYER',
          required: false,
          dataType: 'STRING',
          examples: ['OAB/SP 123456', '123456']
        },

        // DATAS IMPORTANTES
        {
          sourceColumn: ['Data de Criação', 'DataCriacao', 'DataAbertura', 'CriadoEm'],
          targetField: 'created_date',
          category: 'CASE',
          required: false,
          dataType: 'DATE',
          examples: ['01/02/2024', '2024-02-01']
        },
        {
          sourceColumn: ['Data de Distribuição', 'DataDistribuicao', 'Distribuicao'],
          targetField: 'distribution_date',
          category: 'CASE',
          required: false,
          dataType: 'DATE',
          examples: ['15/02/2024', '2024-02-15']
        }
      ],

      transformRules: [
        {
          field: 'process_number',
          rule: {
            type: 'NORMALIZE',
            parameters: {
              pattern: 'CNJ',
              removeSpaces: true,
              addHyphens: true
            },
            description: 'Normalizar número do processo para formato CNJ'
          }
        },
        {
          field: 'claim_value',
          rule: {
            type: 'CURRENCY',
            parameters: {
              currency: 'BRL',
              removeSymbols: true,
              decimal: 2
            },
            description: 'Converter valores monetários para formato decimal'
          }
        },
        {
          field: 'document',
          rule: {
            type: 'NORMALIZE',
            parameters: {
              type: 'CPF_CNPJ',
              addMask: true
            },
            description: 'Formatar CPF/CNPJ'
          }
        }
      ],

      validationRules: [
        {
          field: 'process_number',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'Número do processo é obrigatório'
        },
        {
          field: 'client_name',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'Nome do cliente é obrigatório'
        },
        {
          field: 'process_number',
          type: 'FORMAT',
          parameters: { pattern: /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/ },
          errorMessage: 'Número do processo deve estar no formato CNJ'
        }
      ],

      importStrategies: [
        {
          name: 'Importação Padrão',
          description: 'Importa clientes primeiro, depois casos e eventos',
          order: ['CLIENT', 'CASE', 'EVENT', 'DOCUMENT'],
          dependencies: {
            'CASE': ['CLIENT'],
            'EVENT': ['CASE'],
            'DOCUMENT': ['CASE']
          },
          conflictResolution: 'MERGE'
        }
      ]
    },

    // ================================
    // LEGAL ONE
    // ================================
    LEGAL_ONE: {
      system: 'LEGAL_ONE',
      version: '1.0',
      description: 'Thomson Reuters Legal One - Mapeamento para exportações',

      columnMappings: [
        {
          sourceColumn: ['Matter Number', 'MatterNumber', 'Matter ID', 'Case Number'],
          targetField: 'process_number',
          category: 'CASE',
          required: true,
          dataType: 'STRING',
          examples: ['MAT-2024-001', 'CASE123456']
        },
        {
          sourceColumn: ['Client Name', 'ClientName', 'Client', 'Company Name'],
          targetField: 'client_name',
          category: 'CLIENT',
          required: true,
          dataType: 'STRING',
          examples: ['ABC Corporation', 'John Smith Inc.']
        },
        {
          sourceColumn: ['Matter Title', 'MatterTitle', 'Description', 'Case Title'],
          targetField: 'title',
          category: 'CASE',
          required: true,
          dataType: 'STRING',
          examples: ['Contract Dispute', 'Employment Litigation']
        },
        {
          sourceColumn: ['Responsible Lawyer', 'ResponsibleLawyer', 'Lead Attorney', 'Primary Lawyer'],
          targetField: 'responsible_lawyer',
          category: 'LAWYER',
          required: false,
          dataType: 'STRING',
          examples: ['Jane Doe', 'Michael Johnson']
        },
        {
          sourceColumn: ['Court Name', 'CourtName', 'Jurisdiction', 'Venue'],
          targetField: 'court',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['Superior Court of California', 'Federal District Court']
        },
        {
          sourceColumn: ['Practice Area', 'PracticeArea', 'Legal Area', 'Matter Type'],
          targetField: 'case_type',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Corporate Law', 'Litigation', 'Employment']
        },
        {
          sourceColumn: ['Status', 'Matter Status', 'MatterStatus', 'Case Status'],
          targetField: 'status',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Open', 'Closed', 'On Hold']
        },
        {
          sourceColumn: ['Open Date', 'OpenDate', 'Created Date', 'Start Date'],
          targetField: 'created_date',
          category: 'CASE',
          required: false,
          dataType: 'DATE',
          examples: ['2024-01-15', '01/15/2024']
        }
      ],

      transformRules: [
        {
          field: 'created_date',
          rule: {
            type: 'DATE_FORMAT',
            parameters: {
              inputFormat: 'MM/DD/YYYY',
              outputFormat: 'YYYY-MM-DD'
            },
            description: 'Converter formato de data americano'
          }
        }
      ],

      validationRules: [
        {
          field: 'process_number',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'Matter number is required'
        },
        {
          field: 'client_name',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'Client name is required'
        }
      ],

      importStrategies: [
        {
          name: 'Standard Import',
          description: 'Import clients first, then matters and events',
          order: ['CLIENT', 'CASE', 'EVENT', 'DOCUMENT'],
          dependencies: {
            'CASE': ['CLIENT'],
            'EVENT': ['CASE']
          },
          conflictResolution: 'OVERWRITE'
        }
      ]
    },

    // ================================
    // ASTREA
    // ================================
    ASTREA: {
      system: 'ASTREA',
      version: '1.0',
      description: 'Sistema Astrea - Mapeamento padrão',

      columnMappings: [
        {
          sourceColumn: ['Código do Processo', 'CodigoProcesso', 'CodProcesso', 'ID Processo'],
          targetField: 'case_code',
          category: 'CASE',
          required: true,
          dataType: 'STRING',
          examples: ['PROC001', 'AST-2024-001']
        },
        {
          sourceColumn: ['Número Judicial', 'NumeroJudicial', 'Processo Judicial', 'Número CNJ'],
          targetField: 'process_number',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['1234567-89.2024.1.23.4567']
        },
        {
          sourceColumn: ['Parte Contrária', 'ParteContraria', 'Requerido', 'Contra'],
          targetField: 'opposing_party',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['Empresa XYZ Ltda', 'Pedro Silva']
        },
        {
          sourceColumn: ['Cliente Principal', 'ClientePrincipal', 'Requerente', 'Cliente'],
          targetField: 'client_name',
          category: 'CLIENT',
          required: true,
          dataType: 'STRING',
          examples: ['ABC Indústria S/A', 'Maria Santos']
        },
        {
          sourceColumn: ['Advogado Responsável', 'AdvogadoResponsavel', 'Responsavel', 'Attorney'],
          targetField: 'responsible_lawyer',
          category: 'LAWYER',
          required: false,
          dataType: 'STRING',
          examples: ['Dr. Carlos Oliveira', 'Ana Paula - OAB/RJ 98765']
        },
        {
          sourceColumn: ['Tribunal', 'Corte', 'Juizo', 'Orgao Julgador'],
          targetField: 'court',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['TJSP', 'TJRJ - 1ª Vara Empresarial']
        },
        {
          sourceColumn: ['Status do Processo', 'StatusProcesso', 'Situacao', 'Estado'],
          targetField: 'status',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Em Andamento', 'Suspenso', 'Finalizado']
        },
        {
          sourceColumn: ['Área do Direito', 'AreaDireito', 'Especialidade', 'Pratica'],
          targetField: 'case_type',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Direito Civil', 'Direito Trabalhista', 'Direito Empresarial']
        }
      ],

      transformRules: [
        {
          field: 'status',
          rule: {
            type: 'LOOKUP',
            parameters: {
              mapping: {
                'Em Andamento': 'ACTIVE',
                'Suspenso': 'SUSPENDED',
                'Finalizado': 'CLOSED',
                'Arquivado': 'ARCHIVED'
              }
            },
            description: 'Mapear status do Astrea para status padrão'
          }
        },
        {
          field: 'case_type',
          rule: {
            type: 'LOOKUP',
            parameters: {
              mapping: {
                'Direito Civil': 'CIVIL',
                'Direito Trabalhista': 'LABOR',
                'Direito Empresarial': 'COMMERCIAL',
                'Direito Família': 'FAMILY'
              }
            },
            description: 'Mapear tipos de caso do Astrea'
          }
        }
      ],

      validationRules: [
        {
          field: 'case_code',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'Código do processo é obrigatório'
        },
        {
          field: 'client_name',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'Cliente principal é obrigatório'
        },
        {
          field: 'case_code',
          type: 'UNIQUE',
          parameters: {},
          errorMessage: 'Código do processo deve ser único'
        }
      ],

      importStrategies: [
        {
          name: 'Importação Astrea',
          description: 'Estratégia específica para dados do Astrea',
          order: ['CLIENT', 'CASE', 'EVENT'],
          dependencies: {
            'CASE': ['CLIENT']
          },
          conflictResolution: 'MERGE'
        }
      ]
    },

    // ================================
    // CP-PRO
    // ================================
    CP_PRO: {
      system: 'CP_PRO',
      version: '1.0',
      description: 'Sistema CP-Pro - Mapeamento padrão',

      columnMappings: [
        {
          sourceColumn: ['ID do Caso', 'IDCaso', 'CasoID', 'ID'],
          targetField: 'case_code',
          category: 'CASE',
          required: true,
          dataType: 'STRING',
          examples: ['CP001234', '2024-CASO-001']
        },
        {
          sourceColumn: ['Número do Processo', 'NumProcesso', 'ProcessoNum', 'Judicial'],
          targetField: 'process_number',
          category: 'CASE',
          required: false,
          dataType: 'STRING',
          examples: ['1234567-89.2024.1.23.4567']
        },
        {
          sourceColumn: ['Cliente Razão Social', 'ClienteRazao', 'RazaoSocial', 'NomeCliente'],
          targetField: 'client_name',
          category: 'CLIENT',
          required: true,
          dataType: 'STRING',
          examples: ['Indústria Brasileira S/A', 'José da Silva']
        },
        {
          sourceColumn: ['Escritório', 'EscritorioResponsavel', 'Responsavel', 'Advogado'],
          targetField: 'law_firm',
          category: 'LAWYER',
          required: false,
          dataType: 'STRING',
          examples: ['Silva & Associados', 'Escritório Oliveira']
        },
        {
          sourceColumn: ['Prazo', 'DataPrazo', 'Deadline', 'Vencimento'],
          targetField: 'deadline',
          category: 'CASE',
          required: false,
          dataType: 'DATE',
          examples: ['31/12/2024', '2024-12-31']
        },
        {
          sourceColumn: ['Situação', 'Status', 'Estado', 'Condicao'],
          targetField: 'status',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Ativo', 'Inativo', 'Pendente']
        },
        {
          sourceColumn: ['Valor Contrato', 'ValorContrato', 'Valor', 'Honorarios'],
          targetField: 'contract_value',
          category: 'FINANCIAL',
          required: false,
          dataType: 'CURRENCY',
          examples: ['R$ 15.000,00', '15000.00']
        },
        {
          sourceColumn: ['Tipo de Serviço', 'TipoServico', 'Servico', 'Categoria'],
          targetField: 'service_type',
          category: 'CASE',
          required: false,
          dataType: 'ENUM',
          examples: ['Consultoria', 'Contencioso', 'Preventivo']
        }
      ],

      transformRules: [
        {
          field: 'deadline',
          rule: {
            type: 'DATE_FORMAT',
            parameters: {
              inputFormat: 'DD/MM/YYYY',
              outputFormat: 'YYYY-MM-DD'
            },
            description: 'Converter formato de data brasileiro'
          }
        },
        {
          field: 'contract_value',
          rule: {
            type: 'CURRENCY',
            parameters: {
              currency: 'BRL',
              removeSymbols: true
            },
            description: 'Converter valores em reais'
          }
        }
      ],

      validationRules: [
        {
          field: 'case_code',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'ID do caso é obrigatório'
        },
        {
          field: 'client_name',
          type: 'REQUIRED',
          parameters: {},
          errorMessage: 'Nome do cliente é obrigatório'
        }
      ],

      importStrategies: [
        {
          name: 'Importação CP-Pro',
          description: 'Estratégia otimizada para CP-Pro',
          order: ['CLIENT', 'CASE', 'FINANCIAL'],
          dependencies: {
            'CASE': ['CLIENT'],
            'FINANCIAL': ['CASE']
          },
          conflictResolution: 'SKIP'
        }
      ]
    },

    // Placeholder para outros sistemas
    SAJ: { system: 'SAJ', version: '1.0', description: 'Sistema SAJ', columnMappings: [], transformRules: [], validationRules: [], importStrategies: [] },
    ESAJ: { system: 'ESAJ', version: '1.0', description: 'Sistema e-SAJ', columnMappings: [], transformRules: [], validationRules: [], importStrategies: [] },
    PJE: { system: 'PJE', version: '1.0', description: 'Processo Judicial Eletrônico', columnMappings: [], transformRules: [], validationRules: [], importStrategies: [] },
    THEMIS: { system: 'THEMIS', version: '1.0', description: 'Sistema Themis', columnMappings: [], transformRules: [], validationRules: [], importStrategies: [] },
    ADVBOX: { system: 'ADVBOX', version: '1.0', description: 'Sistema AdvBox', columnMappings: [], transformRules: [], validationRules: [], importStrategies: [] },
    UNKNOWN: { system: 'UNKNOWN', version: '1.0', description: 'Sistema não identificado', columnMappings: [], transformRules: [], validationRules: [], importStrategies: [] }
  };

  /**
   * Obtém o mapeamento para um sistema específico
   */
  static getMapping(system: SourceSystem): SystemMapping {
    return this.mappings[system] || this.mappings.UNKNOWN;
  }

  /**
   * Lista todos os sistemas suportados
   */
  static getSupportedSystems(): SourceSystem[] {
    return Object.keys(this.mappings) as SourceSystem[];
  }

  /**
   * Busca colunas por padrão de texto
   */
  static findColumnsByPattern(system: SourceSystem, pattern: string): SystemColumnMapping[] {
    const mapping = this.getMapping(system);
    return mapping.columnMappings.filter(col => {
      const sources = Array.isArray(col.sourceColumn) ? col.sourceColumn : [col.sourceColumn];
      return sources.some(source =>
        source.toLowerCase().includes(pattern.toLowerCase()) ||
        col.aliases?.some(alias => alias.toLowerCase().includes(pattern.toLowerCase()))
      );
    });
  }

  /**
   * Obtém todas as regras de transformação para um campo
   */
  static getTransformRules(system: SourceSystem, field: string): SystemTransformRule[] {
    const mapping = this.getMapping(system);
    return mapping.transformRules.filter(rule => rule.field === field);
  }

  /**
   * Obtém todas as regras de validação para um campo
   */
  static getValidationRules(system: SourceSystem, field: string): SystemValidationRule[] {
    const mapping = this.getMapping(system);
    return mapping.validationRules.filter(rule => rule.field === field);
  }

  /**
   * Obtém a estratégia de importação padrão
   */
  static getDefaultImportStrategy(system: SourceSystem): ImportStrategy | null {
    const mapping = this.getMapping(system);
    return mapping.importStrategies[0] || null;
  }

  /**
   * Detecta sistema baseado em padrões de colunas
   */
  static detectSystem(columnNames: string[]): { system: SourceSystem; confidence: number } {
    const normalizedColumns = columnNames.map(name => name.toLowerCase().trim());

    const systemScores: Record<SourceSystem, number> = {} as any;

    // Calcular score para cada sistema
    Object.entries(this.mappings).forEach(([systemName, mapping]) => {
      let score = 0;
      const totalColumns = mapping.columnMappings.length;

      if (totalColumns === 0) {
        systemScores[systemName as SourceSystem] = 0;
        return;
      }

      mapping.columnMappings.forEach(colMapping => {
        const sources = Array.isArray(colMapping.sourceColumn)
          ? colMapping.sourceColumn
          : [colMapping.sourceColumn];

        const found = sources.some(source =>
          normalizedColumns.some(col => {
            const normalizedSource = source.toLowerCase().trim();
            return col.includes(normalizedSource) ||
                   normalizedSource.includes(col) ||
                   (colMapping.aliases && colMapping.aliases.some(alias =>
                     col.includes(alias.toLowerCase()) || alias.toLowerCase().includes(col)
                   ));
          })
        );

        if (found) {
          // Dar peso extra para campos obrigatórios
          score += colMapping.required ? 2 : 1;
        }
      });

      systemScores[systemName as SourceSystem] = score / totalColumns;
    });

    // Encontrar o melhor match
    const bestMatch = Object.entries(systemScores)
      .reduce((best, [system, score]) =>
        score > best.score ? { system: system as SourceSystem, score } : best,
        { system: 'UNKNOWN' as SourceSystem, score: 0 }
      );

    return {
      system: bestMatch.system,
      confidence: Math.min(bestMatch.score, 1.0)
    };
  }

  /**
   * Cria um template de mapeamento personalizado
   */
  static createCustomTemplate(
    name: string,
    system: SourceSystem,
    customMappings: SystemColumnMapping[]
  ): SystemMapping {
    const baseMapping = this.getMapping(system);

    return {
      ...baseMapping,
      description: `Template customizado: ${name}`,
      columnMappings: [...baseMapping.columnMappings, ...customMappings]
    };
  }
}

// ================================
// UTILITÁRIOS DE TRANSFORMAÇÃO
// ================================

export class DataTransformer {
  /**
   * Aplica regras de transformação a um valor
   */
  static transformValue(value: any, rule: TransformRule): any {
    if (!value && value !== 0) return value;

    switch (rule.type) {
      case 'DATE_FORMAT':
        return this.transformDate(value, rule.parameters);

      case 'CURRENCY':
        return this.transformCurrency(value, rule.parameters);

      case 'BOOLEAN':
        return this.transformBoolean(value, rule.parameters);

      case 'NORMALIZE':
        return this.transformNormalize(value, rule.parameters);

      case 'LOOKUP':
        return this.transformLookup(value, rule.parameters);

      case 'REGEX':
        return this.transformRegex(value, rule.parameters);

      default:
        return value;
    }
  }

  private static transformDate(value: string, params: any): string {
    // Implementar conversão de formatos de data
    try {
      if (params.inputFormat === 'auto') {
        // Detectar formato automaticamente
        const date = new Date(value);
        return date.toISOString().split('T')[0];
      }

      // Implementar conversão baseada em formato específico
      return value; // Placeholder
    } catch {
      return value;
    }
  }

  private static transformCurrency(value: string, _params: any): number {
    try {
      // Remover símbolos monetários e converter para número
      const cleanValue = value.toString()
        .replace(/[R$€$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

      return parseFloat(cleanValue);
    } catch {
      return 0;
    }
  }

  private static transformBoolean(value: any, _params: any): boolean {
    const truthyValues = ['sim', 'yes', 'true', '1', 'ativo', 'ativado'];
    return truthyValues.includes(value.toString().toLowerCase());
  }

  private static transformNormalize(value: string, params: any): string {
    if (params.type === 'CPF_CNPJ') {
      // Normalizar CPF/CNPJ
      const digits = value.replace(/\D/g, '');
      if (digits.length === 11) {
        return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
      } else if (digits.length === 14) {
        return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
      }
    }

    return value;
  }

  private static transformLookup(value: any, params: any): any {
    return params.mapping[value] || value;
  }

  private static transformRegex(value: string, params: any): string {
    try {
      const regex = new RegExp(params.pattern, params.flags || '');
      return value.replace(regex, params.replacement || '');
    } catch {
      return value;
    }
  }
}

// ================================
// VALIDADOR DE DADOS
// ================================

export class DataValidator {
  /**
   * Valida um valor baseado em regras
   */
  static validateValue(value: any, rules: SystemValidationRule[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    rules.forEach(rule => {
      switch (rule.type) {
        case 'REQUIRED':
          if (!value || (typeof value === 'string' && !value.trim())) {
            errors.push(rule.errorMessage);
          }
          break;

        case 'FORMAT':
          if (value && rule.parameters.pattern && !rule.parameters.pattern.test(value)) {
            errors.push(rule.errorMessage);
          }
          break;

        case 'RANGE':
          const num = Number(value);
          if (!isNaN(num)) {
            if (rule.parameters.min !== undefined && num < rule.parameters.min) {
              errors.push(rule.errorMessage);
            }
            if (rule.parameters.max !== undefined && num > rule.parameters.max) {
              errors.push(rule.errorMessage);
            }
          }
          break;
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

console.log(`${ICONS.SUCCESS} Sistema de mapeamentos carregado com ${SystemMappings.getSupportedSystems().length} sistemas suportados`);