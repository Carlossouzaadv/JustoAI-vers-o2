/**
 * Prisma Mock Helpers for Testing
 * Provides clean, type-safe mocks for Prisma operations
 * Following the Padrão-Ouro: No `any`, no `as Type` casting
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';

/**
 * Type-safe Prisma mock factory
 * Returns a DeepMockProxy that matches the PrismaClient interface
 */
export function createPrismaMock(): DeepMockProxy<PrismaClient> {
  return mockDeep<PrismaClient>();
}

/**
 * Setup transaction mock for atomic operations
 * Simulates prisma.$transaction behavior
 *
 * Usage:
 * const mockPrisma = createPrismaMock();
 * setupTransactionMock(mockPrisma, async (tx) => {
 *   await tx.workspaceCredits.findUnique(...);
 * });
 */
export function setupTransactionMock(
  mockPrisma: DeepMockProxy<PrismaClient>,
  callback?: (tx: Prisma.TransactionClient) => Promise<unknown>
): void {
  mockPrisma.$transaction.mockImplementation(async (fn: unknown) => {
    // Type guard: ensure fn is a function
    if (typeof fn === 'function') {
      // Create a mock TransactionClient that delegates to the same mock
      const txClient = mockPrisma as unknown as Prisma.TransactionClient;
      return await fn(txClient);
    }

    // Fallback for non-function args (arrays of queries)
    if (Array.isArray(fn)) {
      return fn;
    }

    throw new Error('Invalid argument to $transaction');
  });
}

/**
 * Setup mock for aggregate operations
 * Example: creditHolds aggregation for available credits calculation
 */
export function setupAggregateMock(
  mockPrisma: DeepMockProxy<PrismaClient>,
  aggregateResult: {
    _sum: {
      reportCreditsReserved: number | null;
      fullCreditsReserved: number | null;
    };
  }
): void {
  mockPrisma.scheduledCreditHold.aggregate.mockResolvedValue(aggregateResult);
}

/**
 * Helper to reset all mocks
 */
export function resetPrismaMocks(mockPrisma: DeepMockProxy<PrismaClient>): void {
  mockReset(mockPrisma);
}

/**
 * Helper to create mock workspace credits record
 * Matches WorkspaceCreditsRecord interface from credit-system.ts
 */
export function createMockWorkspaceCredits(overrides?: Partial<{
  id: string;
  workspaceId: string;
  reportCreditsBalance: number;
  fullCreditsBalance: number;
  reportCreditsRolloverCap: number;
  fullCreditsRolloverCap: number;
  createdAt: Date;
  updatedAt: Date;
}>): {
  id: string;
  workspaceId: string;
  reportCreditsBalance: number;
  fullCreditsBalance: number;
  reportCreditsRolloverCap: number;
  fullCreditsRolloverCap: number;
  createdAt: Date;
  updatedAt: Date;
} {
  const now = new Date();
  return {
    id: 'test-credits-1',
    workspaceId: 'test-workspace-1',
    reportCreditsBalance: 10,
    fullCreditsBalance: 5,
    reportCreditsRolloverCap: 36,
    fullCreditsRolloverCap: 50,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Helper to create mock credit allocation
 */
export function createMockCreditAllocation(overrides?: Partial<{
  id: string;
  workspaceId: string;
  type: 'MONTHLY' | 'BONUS' | 'PACK';
  amount: number;
  remainingAmount: number;
  expiresAt: Date | null;
  sourceDescription: string | null;
  createdAt: Date;
}>): {
  id: string;
  workspaceId: string;
  type: 'MONTHLY' | 'BONUS' | 'PACK';
  amount: number;
  remainingAmount: number;
  expiresAt: Date | null;
  sourceDescription: string | null;
  createdAt: Date;
} {
  const now = new Date();
  return {
    id: 'alloc-1',
    workspaceId: 'test-workspace-1',
    type: 'MONTHLY',
    amount: 10,
    remainingAmount: 8,
    expiresAt: null,
    sourceDescription: 'Monthly allocation',
    createdAt: now,
    ...overrides,
  };
}

/**
 * Helper to create mock credit transaction
 */
export function createMockCreditTransaction(overrides?: Partial<{
  id: string;
  workspaceId: string;
  allocationId: string | null;
  type: 'CREDIT' | 'DEBIT';
  creditCategory: 'REPORT' | 'FULL';
  amount: number;
  reason: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}>): {
  id: string;
  workspaceId: string;
  allocationId: string | null;
  type: 'CREDIT' | 'DEBIT';
  creditCategory: 'REPORT' | 'FULL';
  amount: number;
  reason: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
} {
  const now = new Date();
  return {
    id: 'tx-1',
    workspaceId: 'test-workspace-1',
    allocationId: 'alloc-1',
    type: 'DEBIT',
    creditCategory: 'REPORT',
    amount: 1,
    reason: 'Test debit',
    metadata: null,
    createdAt: now,
    ...overrides,
  };
}
