import { z } from 'zod'

// ================================
// VALIDATIONS FOR PROCESS MONITORING
// ================================

// Base schemas
const idSchema = z.string().cuid()
const emailSchema = z.string().email()
const phoneSchema = z.string().min(10).max(20).optional()
const slugSchema = z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, {
  message: 'Slug must contain only lowercase letters, numbers, and hyphens'
})

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']).default('FREE'),
  settings: z.record(z.string(), z.any()).optional(),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  settings: z.record(z.string(), z.any()).optional(),
})

// Client schemas
export const createClientSchema = z.object({
  workspaceId: idSchema,
  name: z.string().min(2).max(100),
  email: emailSchema.optional(),
  phone: phoneSchema,
  document: z.string().max(20).optional(), // CPF/CNPJ
  type: z.enum(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT', 'NGO']).default('INDIVIDUAL'),
  address: z.string().max(200).optional(),
  city: z.string().max(50).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(10).optional(),
  country: z.string().max(3).default('BR'),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const updateClientSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
  document: z.string().max(20).optional(),
  type: z.enum(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT', 'NGO']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(50).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(10).optional(),
  country: z.string().max(3).optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

// User schemas
export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).max(100),
  avatar: z.string().url().optional(),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).default('USER'),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional(),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  settings: z.record(z.string(), z.any()).optional(),
})

// UserWorkspace schemas
export const addUserToWorkspaceSchema = z.object({
  userId: idSchema,
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
  permissions: z.record(z.string(), z.any()).optional(),
})

export const updateUserWorkspaceSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  permissions: z.record(z.string(), z.any()).optional(),
})

// Query params schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(10),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).optional(),
})

export const workspaceQuerySchema = paginationSchema

export const clientQuerySchema = paginationSchema.extend({
  workspaceId: idSchema.optional(),
  type: z.enum(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT', 'NGO']).optional(),
})

// Type inference
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type AddUserToWorkspaceInput = z.infer<typeof addUserToWorkspaceSchema>
export type UpdateUserWorkspaceInput = z.infer<typeof updateUserWorkspaceSchema>
export type PaginationQuery = z.infer<typeof paginationSchema>
export type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>
export type ClientQuery = z.infer<typeof clientQuerySchema>

// ================================
// PROCESS MONITORING SCHEMAS
// ================================

// Process Number validation
const processNumberSchema = z.string().min(15).max(30).refine(
  (value) => {
    const normalized = value.replace(/\D/g, '');
    return normalized.length >= 15 && normalized.length <= 20;
  },
  { message: 'Número do processo deve ter formato CNJ válido' }
);

// Monitored Process schemas
export const createMonitoredProcessSchema = z.object({
  processNumber: processNumberSchema,
  court: z.string().min(1).max(200),
  clientName: z.string().min(1).max(200),
  caseId: z.string().cuid().optional(),
  syncFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).default('DAILY'),
  alertsEnabled: z.boolean().default(true),
  alertRecipients: z.array(emailSchema).default([]),
  fetchInitialData: z.boolean().default(true),
});

export const updateMonitoredProcessSchema = z.object({
  court: z.string().min(1).max(200).optional(),
  clientName: z.string().min(1).max(200).optional(),
  caseId: z.string().cuid().nullable().optional(),
  monitoringStatus: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']).optional(),
  syncFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).optional(),
  alertsEnabled: z.boolean().optional(),
  alertRecipients: z.array(emailSchema).optional(),
});

// Process Alert schemas
export const createProcessAlertSchema = z.object({
  processId: z.string().cuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.enum(['MOVEMENT', 'DEADLINE', 'ERROR', 'SYNC_FAILURE', 'IMPORTANT_DECISION']).default('MOVEMENT'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const markAlertsReadSchema = z.object({
  alertIds: z.array(z.string().cuid()).min(1),
  markAsRead: z.boolean().default(true),
});

// Excel Upload schemas
export const excelProcessRowSchema = z.object({
  numeroProcesso: processNumberSchema,
  tribunal: z.string().min(1).max(200),
  nomeCliente: z.string().min(1).max(200),
  observacoes: z.string().max(1000).optional(),
  frequenciaSync: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).default('DAILY'),
  alertasAtivos: z.boolean().default(true),
  emailsAlerta: z.array(emailSchema).default([]),
});

// Process Query schemas
export const processQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']).optional(),
  court: z.string().optional(),
  hasCase: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'processNumber', 'clientName', 'lastSync']).default('createdAt'),
});

export const alertQuerySchema = paginationSchema.extend({
  read: z.enum(['true', 'false', 'all']).default('all'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  type: z.enum(['MOVEMENT', 'DEADLINE', 'ERROR', 'SYNC_FAILURE', 'IMPORTANT_DECISION']).optional(),
  processId: z.string().cuid().optional(),
  sortBy: z.enum(['createdAt', 'severity', 'type']).default('createdAt'),
});

// Sync Action schemas
export const syncProcessActionSchema = z.object({
  action: z.literal('sync'),
  force: z.boolean().default(false),
});

// Batch configuration schemas
export const configureProcessAlertsSchema = z.object({
  processIds: z.array(z.string().cuid()).min(1),
  alertsEnabled: z.boolean(),
  alertRecipients: z.array(emailSchema),
});

// Type inference for Process Monitoring
export type CreateMonitoredProcessInput = z.infer<typeof createMonitoredProcessSchema>
export type UpdateMonitoredProcessInput = z.infer<typeof updateMonitoredProcessSchema>
export type CreateProcessAlertInput = z.infer<typeof createProcessAlertSchema>
export type MarkAlertsReadInput = z.infer<typeof markAlertsReadSchema>
export type ExcelProcessRowInput = z.infer<typeof excelProcessRowSchema>
export type ProcessQuery = z.infer<typeof processQuerySchema>
export type AlertQuery = z.infer<typeof alertQuerySchema>
export type SyncProcessActionInput = z.infer<typeof syncProcessActionSchema>
export type ConfigureProcessAlertsInput = z.infer<typeof configureProcessAlertsSchema>