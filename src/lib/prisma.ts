import { PrismaClient } from '@prisma/client'
import { log, logError } from '@/lib/services/logger';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Utility functions
export async function connectPrisma() {
  try {
    await prisma.$connect()
    log.info({ msg: '✅ Connected to database' })
  } catch (_error) {
    logError(error, '❌ Failed to connect to database:', { component: 'refactored' })
    throw error
  }
}

export async function disconnectPrisma() {
  await prisma.$disconnect()
  log.info({ msg: '🔌 Disconnected from database' })
}

// Default export for compatibility
export default prisma