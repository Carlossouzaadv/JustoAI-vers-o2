// ================================================================
// EXCEL ROW SCHEMA - Validação Rigorosa de Processo Jurídico
// ================================================================
// Este schema é a "verdade absoluta" do que esperamos de uma linha Excel.
// Segue o "Mandato Inegociável": ZERO `any`, ZERO `as` perigoso, Type Guards explícitos.
//
// Cada field tem:
// 1. Tipo primitivo esperado
// 2. Coerção/transformação (se necessário)
// 3. Validações semânticas (regex, enum, etc)
// 4. Mensagens de erro específicas em português

import { z } from 'zod';

// ===== ENUMERAÇÕES =====

export const ProcessStatusEnum = z.enum(
  ['ATIVO', 'ENCERRADO', 'SUSPENSO', 'PARADO'],
  {
    errorMap: () => ({
      message: 'Status deve ser: ATIVO, ENCERRADO, SUSPENSO ou PARADO',
    }),
  }
);
export type ProcessStatus = z.infer<typeof ProcessStatusEnum>;

export const CourtsEnum = z.enum(
  ['TJSP', 'TRJ', 'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'STJ', 'STF'],
  {
    errorMap: () => ({
      message: 'Tribunal inválido. Tribunais aceitos: TJSP, TRJ, TRF1, TRF2, TRF3, TRF4, TRF5, STJ, STF',
    }),
  }
);
export type Court = z.infer<typeof CourtsEnum>;

export const SyncFrequencyEnum = z.enum(
  ['MANUAL', 'HOURLY', 'DAILY', 'WEEKLY'],
  {
    errorMap: () => ({
      message: 'Frequência deve ser: MANUAL, HOURLY, DAILY ou WEEKLY',
    }),
  }
);
export type SyncFrequency = z.infer<typeof SyncFrequencyEnum>;

// ===== FIELD VALIDATORS =====

/**
 * Valida número de processo no formato CNJ:
 * NNNNNNN-DD.AAAA.J.TT.OOOO
 * Exemplo: 0000001-23.2024.1.02.0000
 */
const ProcessNumberSchema = z
  .string()
  .trim()
  .regex(
    /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/,
    'Formato de processo inválido. Use: NNNNNNN-DD.AAAA.J.TT.OOOO (CNJ)'
  )
  .describe('Número de processo no formato CNJ');

/**
 * Email com validação semântica
 */
const EmailSchema = z
  .string()
  .trim()
  .email('Email inválido')
  .toLowerCase()
  .describe('Email válido');

/**
 * Nome de cliente (3-255 chars, sem números no início)
 */
const ClientNameSchema = z
  .string()
  .trim()
  .min(3, 'Nome deve ter pelo menos 3 caracteres')
  .max(255, 'Nome não pode ter mais de 255 caracteres')
  .regex(/^[A-ZÀ-Ÿ]/i, 'Nome deve começar com uma letra')
  .describe('Nome do cliente');

/**
 * Valor em reais: aceita 1000,00 ou 1.000,00
 */
const MoneySchema = z
  .string()
  .trim()
  .regex(
    /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?$/,
    'Valor inválido. Use: 1000,00 ou 1.000,00'
  )
  .describe('Valor em reais (BRL)');

/**
 * Data em DD/MM/YYYY ou YYYY-MM-DD
 */
const DateSchema = z
  .string()
  .trim()
  .regex(
    /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/,
    'Data inválida. Use: DD/MM/YYYY ou YYYY-MM-DD'
  )
  .describe('Data válida');

/**
 * Nome do juiz (3-100 chars)
 */
const JudgeNameSchema = z
  .string()
  .trim()
  .min(3, 'Nome do juiz deve ter pelo menos 3 caracteres')
  .max(100, 'Nome do juiz não pode ter mais de 100 caracteres')
  .optional()
  .describe('Nome do juiz (opcional)');

/**
 * Descrição (até 1000 chars)
 */
const DescriptionSchema = z
  .string()
  .trim()
  .max(1000, 'Descrição não pode ter mais de 1000 caracteres')
  .optional()
  .describe('Descrição do caso (opcional)');

// ===== MAIN SCHEMA =====

export const ExcelRowSchema = z.object(
  {
    // Campos obrigatórios
    'Número de Processo': ProcessNumberSchema,
    'Nome do Cliente': ClientNameSchema,
    'Tribunal': CourtsEnum,

    // Campos opcionais
    'Email': EmailSchema.optional(),
    'Status': ProcessStatusEnum.optional(),
    'Valor da Causa': MoneySchema.optional(),
    'Nome do Juiz': JudgeNameSchema,
    'Descrição': DescriptionSchema,
    'Data de Distribuição': DateSchema.optional(),
    'Frequência de Sincronização': SyncFrequencyEnum.optional(),
    'Alertas Ativos': z
      .union([z.boolean(), z.enum(['sim', 'não', 'true', 'false', 'Sim', 'Não', 'True', 'False'])])
      .transform((v) => v === true || String(v).toLowerCase() === 'sim' || String(v).toLowerCase() === 'true')
      .optional()
      .describe('Ativar alertas'),
    'Emails para Alerta': z
      .string()
      .transform((v) =>
        v
          .split(',')
          .map((e) => e.trim())
          .filter((e) => e.length > 0)
      )
      .optional()
      .describe('Emails separados por vírgula'),
  },
  {
    errorMap: (issue, ctx) => {
      // Mensagens customizadas por tipo de erro
      if (issue.code === z.ZodErrorCode.invalid_type) {
        return { message: `Campo esperado do tipo ${issue.expected}` };
      }
      return { message: ctx.defaultError };
    },
  }
);

export type ExcelRow = z.infer<typeof ExcelRowSchema>;

/**
 * Extrai o nome da coluna para uso em relatórios de erro
 */
export function getColumnName(key: keyof typeof ExcelRowSchema.shape): string {
  return key.toString();
}

/**
 * Constantes para documentação e template
 */
export const EXCEL_SCHEMA_INFO = {
  requiredColumns: ['Número de Processo', 'Nome do Cliente', 'Tribunal'],
  optionalColumns: [
    'Email',
    'Status',
    'Valor da Causa',
    'Nome do Juiz',
    'Descrição',
    'Data de Distribuição',
    'Frequência de Sincronização',
    'Alertas Ativos',
    'Emails para Alerta',
  ],
  maxRows: 10000,
  maxFileSize: '10MB',
} as const;
