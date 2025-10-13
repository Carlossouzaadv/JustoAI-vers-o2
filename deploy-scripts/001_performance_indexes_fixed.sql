-- Performance Indexes Migration (FIXED)
-- Índices otimizados para melhorar performance das consultas
-- Corrigido para usar nomes de colunas corretos

-- Índices para tabela users
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "users_last_login_idx" ON "users" ("lastLoginAt" DESC);
CREATE INDEX IF NOT EXISTS "users_workspace_role_idx" ON "user_workspaces" ("workspaceId", "role");

-- Índices para tabela workspaces
CREATE INDEX IF NOT EXISTS "workspaces_created_at_idx" ON "workspaces" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "workspaces_status_idx" ON "workspaces" ("status");

-- Índices para tabela clients
CREATE INDEX IF NOT EXISTS "clients_workspace_idx" ON "clients" ("workspaceId");
CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients" ("name");
CREATE INDEX IF NOT EXISTS "clients_email_idx" ON "clients" ("email");
CREATE INDEX IF NOT EXISTS "clients_created_at_idx" ON "clients" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "clients_workspace_created_idx" ON "clients" ("workspaceId", "createdAt" DESC);

-- Índices para tabela cases
CREATE INDEX IF NOT EXISTS "cases_client_idx" ON "cases" ("clientId");
CREATE INDEX IF NOT EXISTS "cases_workspace_idx" ON "cases" ("workspaceId");
CREATE INDEX IF NOT EXISTS "cases_status_idx" ON "cases" ("status");
CREATE INDEX IF NOT EXISTS "cases_priority_idx" ON "cases" ("priority");
CREATE INDEX IF NOT EXISTS "cases_created_at_idx" ON "cases" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "cases_updated_at_idx" ON "cases" ("updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "cases_workspace_status_idx" ON "cases" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "cases_client_status_idx" ON "cases" ("clientId", "status");

-- Índices para tabela case_events (CORRIGIDO: usa eventDate, não date)
CREATE INDEX IF NOT EXISTS "case_events_case_idx" ON "case_events" ("caseId");
CREATE INDEX IF NOT EXISTS "case_events_date_idx" ON "case_events" ("eventDate" DESC);
CREATE INDEX IF NOT EXISTS "case_events_type_idx" ON "case_events" ("type");
CREATE INDEX IF NOT EXISTS "case_events_case_date_idx" ON "case_events" ("caseId", "eventDate" DESC);

-- Índices para tabela case_documents
CREATE INDEX IF NOT EXISTS "case_documents_case_idx" ON "case_documents" ("caseId");
CREATE INDEX IF NOT EXISTS "case_documents_type_idx" ON "case_documents" ("type");
CREATE INDEX IF NOT EXISTS "case_documents_status_idx" ON "case_documents" ("ocrStatus");
CREATE INDEX IF NOT EXISTS "case_documents_uploaded_at_idx" ON "case_documents" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "case_documents_case_type_idx" ON "case_documents" ("caseId", "type");

-- Índices para tabela case_analysis_versions
CREATE INDEX IF NOT EXISTS "case_analysis_case_idx" ON "case_analysis_versions" ("caseId");
CREATE INDEX IF NOT EXISTS "case_analysis_version_idx" ON "case_analysis_versions" ("version");
CREATE INDEX IF NOT EXISTS "case_analysis_created_at_idx" ON "case_analysis_versions" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "case_analysis_case_version_idx" ON "case_analysis_versions" ("caseId", "version" DESC);

-- Índices para tabela ai_cache
CREATE INDEX IF NOT EXISTS "ai_cache_key_idx" ON "ai_cache" ("cacheKey");
CREATE INDEX IF NOT EXISTS "ai_cache_type_idx" ON "ai_cache" ("type");
CREATE INDEX IF NOT EXISTS "ai_cache_created_at_idx" ON "ai_cache" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ai_cache_expires_at_idx" ON "ai_cache" ("expiresAt");
CREATE INDEX IF NOT EXISTS "ai_cache_workspace_idx" ON "ai_cache" ("workspaceId");

-- Índices para tabela report_schedules
CREATE INDEX IF NOT EXISTS "report_schedules_workspace_idx" ON "report_schedules" ("workspaceId");
CREATE INDEX IF NOT EXISTS "report_schedules_next_execution_idx" ON "report_schedules" ("nextRun");
CREATE INDEX IF NOT EXISTS "report_schedules_frequency_idx" ON "report_schedules" ("frequency");
CREATE INDEX IF NOT EXISTS "report_schedules_active_idx" ON "report_schedules" ("enabled");

-- Índices para tabela monitored_processes
CREATE INDEX IF NOT EXISTS "monitored_processes_workspace_idx" ON "monitored_processes" ("workspaceId");
CREATE INDEX IF NOT EXISTS "monitored_processes_number_idx" ON "monitored_processes" ("processNumber");
CREATE INDEX IF NOT EXISTS "monitored_processes_court_idx" ON "monitored_processes" ("court");
CREATE INDEX IF NOT EXISTS "monitored_processes_status_idx" ON "monitored_processes" ("monitoringStatus");
CREATE INDEX IF NOT EXISTS "monitored_processes_last_sync_idx" ON "monitored_processes" ("lastSync" DESC);

-- Índices para tabela process_movements
CREATE INDEX IF NOT EXISTS "process_movements_process_idx" ON "process_movements" ("monitoredProcessId");
CREATE INDEX IF NOT EXISTS "process_movements_date_idx" ON "process_movements" ("date" DESC);
CREATE INDEX IF NOT EXISTS "process_movements_type_idx" ON "process_movements" ("type");
CREATE INDEX IF NOT EXISTS "process_movements_process_date_idx" ON "process_movements" ("monitoredProcessId", "date" DESC);

-- Índices para tabela process_alerts
CREATE INDEX IF NOT EXISTS "process_alerts_process_idx" ON "process_alerts" ("monitoredProcessId");
CREATE INDEX IF NOT EXISTS "process_alerts_type_idx" ON "process_alerts" ("type");
CREATE INDEX IF NOT EXISTS "process_alerts_severity_idx" ON "process_alerts" ("severity");
CREATE INDEX IF NOT EXISTS "process_alerts_created_at_idx" ON "process_alerts" ("createdAt" DESC);

-- Índices para tabela system_imports
CREATE INDEX IF NOT EXISTS "system_imports_workspace_idx" ON "system_imports" ("workspaceId");
CREATE INDEX IF NOT EXISTS "system_imports_source_idx" ON "system_imports" ("sourceSystem");
CREATE INDEX IF NOT EXISTS "system_imports_status_idx" ON "system_imports" ("status");
CREATE INDEX IF NOT EXISTS "system_imports_created_at_idx" ON "system_imports" ("createdAt" DESC);

-- Índices para tabela imported_data_items
CREATE INDEX IF NOT EXISTS "imported_data_items_import_idx" ON "imported_data_items" ("systemImportId");
CREATE INDEX IF NOT EXISTS "imported_data_items_type_idx" ON "imported_data_items" ("dataType");
CREATE INDEX IF NOT EXISTS "imported_data_items_status_idx" ON "imported_data_items" ("status");

-- Índices compostos para consultas complexas
CREATE INDEX IF NOT EXISTS "clients_workspace_name_idx" ON "clients" ("workspaceId", "name");
CREATE INDEX IF NOT EXISTS "cases_workspace_priority_status_idx" ON "cases" ("workspaceId", "priority", "status");
CREATE INDEX IF NOT EXISTS "cases_client_updated_at_idx" ON "cases" ("clientId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ai_cache_workspace_type_key_idx" ON "ai_cache" ("workspaceId", "type", "cacheKey");

-- Índices para otimização de JOINs frequentes
CREATE INDEX IF NOT EXISTS "user_workspaces_user_workspace_idx" ON "user_workspaces" ("userId", "workspaceId");
CREATE INDEX IF NOT EXISTS "case_documents_case_uploaded_idx" ON "case_documents" ("caseId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "process_movements_process_date_type_idx" ON "process_movements" ("monitoredProcessId", "date" DESC, "type");

-- Comentários para documentação
COMMENT ON INDEX "users_email_idx" IS 'Otimiza login e busca por email';
COMMENT ON INDEX "clients_workspace_created_idx" IS 'Otimiza listagem paginada de clientes por workspace';
COMMENT ON INDEX "cases_workspace_status_idx" IS 'Otimiza dashboard com filtros por status';
