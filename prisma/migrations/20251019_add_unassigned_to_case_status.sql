-- ================================================================
-- MIGRAÇÃO: Adicionar valor UNASSIGNED ao enum CaseStatus
-- ================================================================
-- Problema: Código tenta criar cases com status='UNASSIGNED'
-- mas o enum no banco não tem este valor
-- Solução: Adicionar UNASSIGNED ao enum CaseStatus

-- PostgreSQL: usar ALTER TYPE para adicionar novo valor ao enum
ALTER TYPE "CaseStatus" ADD VALUE 'UNASSIGNED' AFTER 'CANCELLED';
