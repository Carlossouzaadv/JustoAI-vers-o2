
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 INICIANDO VERIFICAÇÃO DO BANCO DE DADOS...')

    try {
        // 1. Verificar estrutura da tabela users
        console.log('\n================================================================')
        console.log('1. ESTRUTURA DA TABELA USERS')
        console.log('================================================================')
        const userColumns = await prisma.$queryRaw`
      SELECT 
          column_name,
          data_type,
          is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('name', 'practiceAreas', 'mainGoals', 'onboardingCompleted', 'onboardingCompletedAt')
      ORDER BY ordinal_position;
    `
        console.table(userColumns)

        // 2. Verificar estrutura da tabela clients (Confirmar que userId NÃO existe)
        console.log('\n================================================================')
        console.log('2. VERIFICAR SE USERID EXISTE EM CLIENTS (DEVE SER VAZIO)')
        console.log('================================================================')
        const clientColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'clients'
        AND column_name = 'userId';
    `

        if (Array.isArray(clientColumns) && clientColumns.length === 0) {
            console.log('✅ SUCESSO: Coluna userId NÃO encontrada na tabela clients.')
        } else {
            console.log('❌ ERRO: Coluna userId encontrada!', clientColumns)
        }

        // 3. Verificar dados de onboarding (Top 5 users)
        console.log('\n================================================================')
        console.log('3. DADOS DE ONBOARDING (TOP 5 RECENTES)')
        console.log('================================================================')
        const users = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        "practiceAreas",
        "mainGoals",
        "onboardingCompleted",
        "onboardingCompletedAt"
      FROM users
      ORDER BY "createdAt" DESC
      LIMIT 5;
    `
        console.table(users)

    } catch (error) {
        console.error('❌ ERRO NA VERIFICAÇÃO:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
