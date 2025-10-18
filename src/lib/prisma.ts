import { PrismaClient } from '@prisma/client'

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
    console.log('✅ Connected to database')
  } catch (error) {
    console.error('❌ Failed to connect to database:', error)
    throw error
  }
}

export async function disconnectPrisma() {
  await prisma.$disconnect()
  console.log('🔌 Disconnected from database')
}

// Default export for compatibility
export default prisma