-- ====================================================================
-- ⚠️ SUPABASE RLS FIXES - EXECUTE THESE QUERIES
-- ====================================================================
-- Data: 2025-10-17
-- Propósito: Corrigir políticas RLS que estão impedindo criação de usuários
--
-- INSTRUÇÕES:
-- 1. Abra: https://app.supabase.com → Seu Projeto → SQL Editor
-- 2. Cole CADA seção em uma nova query
-- 3. Execute na ordem indicada
-- 4. Aguarde ~5 segundos entre queries
--
-- ====================================================================

-- ====================================================================
-- PARTE 1: VERIFICAR ESTADO ATUAL (Executar PRIMEIRO)
-- ====================================================================
-- Execute isto para diagnosticar:
-- Se ver 0 linhas = INSERT policy NÃO existe (PROBLEMA!)
-- Se ver 1+ linhas = INSERT policy existe (OK)

SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'INSERT'
ORDER BY policyname;

-- ====================================================================
-- PARTE 2: LIMPAR POLÍTICAS ANTIGAS (Se necessário)
-- ====================================================================
-- ⚠️ ATENÇÃO: Executar APENAS se houver conflitos
-- Se não tiver certeza, PULE esta parte

-- DROP POLICY IF EXISTS "Authenticated users can insert their user record" ON users;
-- DROP POLICY IF EXISTS "Service role can create users" ON users;

-- ====================================================================
-- PARTE 3: ADICIONAR POLÍTICAS DE INSERT (EXECUTAR OBRIGATORIAMENTE)
-- ====================================================================

-- Policy 1: Usuários autenticados podem criar seu próprio registro
CREATE POLICY "Authenticated users can insert their user record" ON users
FOR INSERT
WITH CHECK (
  "supabaseId" = auth.uid()::text
);

-- Policy 2: Service role (backend) pode criar usuários
CREATE POLICY "Service role can create users" ON users
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

-- ====================================================================
-- PARTE 4: VERIFICAR POLÍTICAS AGORA EXISTEM
-- ====================================================================
-- Execute isto para confirmar que as políticas foram criadas

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- Resultado esperado: Deve ter:
-- - Users can read own data [SELECT]
-- - Users can update own data [UPDATE]
-- - Authenticated users can insert their user record [INSERT]
-- - Service role can create users [INSERT]

-- ====================================================================
-- PARTE 5: VERIFICAR INTEGRIDADE DE DADOS
-- ====================================================================

-- Quantos usuários existem?
SELECT COUNT(*) as total_users FROM users;

-- Quantos workspaces?
SELECT COUNT(*) as total_workspaces FROM workspaces;

-- Usuários com workspaces?
SELECT
  u.id,
  u.email,
  COUNT(uw.id) as workspace_count
FROM users u
LEFT JOIN user_workspaces uw ON u.id = uw."userId"
GROUP BY u.id, u.email
ORDER BY u."createdAt" DESC
LIMIT 5;

-- ====================================================================
-- PARTE 6: TESTAR RLS POLICIES (Executar com cuidado)
-- ====================================================================
-- ⚠️ Isto requer que você substitua:
-- - 'your-user-uuid' pelo UUID real de um usuário
-- - 'your-supabase-uid' pelo auth.uid() do usuário

-- Exemplo: Verificar se policy SELECT funciona para um usuário
-- SET "request.jwt.claims" = jsonb_build_object('sub', 'your-supabase-uid');
-- SELECT COUNT(*) FROM users WHERE "supabaseId" = 'your-supabase-uid';

-- ====================================================================
-- PARTE 7: MONITORAR LOGS (Se houver problemas)
-- ====================================================================

-- Ver logs de erro de RLS
SELECT
  message,
  detail,
  context,
  created_at
FROM postgres_logs
WHERE message ILIKE '%policy%'
ORDER BY created_at DESC
LIMIT 10;

-- ====================================================================
-- RESUMO DO QUE FOI FEITO
-- ====================================================================
-- ✅ Adicionadas 2 políticas de INSERT para a tabela 'users'
-- ✅ Agora usuários podem ser criados via Supabase Auth
-- ✅ Service role (backend) pode sincronizar usuários
-- ✅ RLS ainda protege dados sensíveis
--
-- PRÓXIMO PASSO: Testar signup com novo usuário
-- ====================================================================
