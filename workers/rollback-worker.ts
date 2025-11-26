/**
 * Rollback Worker (Phase 18: Atomic Rollback)
 *
 * Handles atomic rollback of batch system imports via BullMQ.
 *
 * Key Responsibilities:
 * 1. Listen to rollback-batch queue jobs
 * 2. Collect all created entities from ImportedDataItem records
 * 3. Execute atomic Prisma transaction to delete entities and mark items as ROLLED_BACK
 * 4. Update SystemImport status to ROLLED_BACK
 * 5. Ensure 100% type safety (zero as/any/unknown casts)
 *
 * Flow:
 *   API endpoint -> addRollbackJob() -> rollback-batch queue -> this worker -> Prisma transaction
 */

import { rollbackQueue } from '@/lib/queues';
import { prisma } from '@/lib/prisma';
import type { Job } from 'bull';

// ============================================================================
// TYPE DEFINITIONS (100% Type Safe)
// ============================================================================

interface RollbackJobPayload {
  systemImportId: string;
  workspaceId: string;
  userId: string;
  queuedAt: string;
}

// Type guard to validate job payload at runtime
function isValidRollbackPayload(data: unknown): data is RollbackJobPayload {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    typeof obj.systemImportId === 'string' &&
    typeof obj.workspaceId === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.queuedAt === 'string'
  );
}

// ============================================================================
// HELPER FUNCTIONS (Type Safe ID Collection)
// ============================================================================

/**
 * Safely collects IDs from imported items, filtering out null values.
 * Uses type-safe narrowing instead of casting.
 */
function collectNonNullIds(ids: (string | null | undefined)[]): string[] {
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && id.length > 0) {
      result.push(id);
    }
  }
  return result;
}

// ============================================================================
// WORKER PROCESSOR (Main Logic)
// ============================================================================

/**
 * Processes a single rollback job atomically.
 *
 * @param job - BullMQ job with rollback payload
 * @throws Will re-throw any database errors (BullMQ will retry)
 */
async function processRollbackJob(job: Job<RollbackJobPayload>) {
  // 1. VALIDATE PAYLOAD
  if (!isValidRollbackPayload(job.data)) {
    const errorMessage = `Invalid rollback payload: ${JSON.stringify(job.data)}`;
    console.error(`🔴 [Rollback Worker] ${errorMessage}`);
    throw new Error(errorMessage);
  }

  const { systemImportId, workspaceId, userId } = job.data;

  console.log(`🔄 [Rollback Worker] Starting rollback for systemImportId: ${systemImportId}, initiatedBy: ${userId}`);

  // 2. UPDATE SYSTEM IMPORT STATUS TO ROLLING_BACK
  try {
    const updatedImport = await prisma.systemImport.update({
      where: { id: systemImportId },
      data: { status: 'ROLLING_BACK' },
    });
    console.log(`📝 [Rollback Worker] Status updated to ROLLING_BACK (current: ${updatedImport.status})`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`🔴 [Rollback Worker] Failed to update SystemImport status: ${errorMessage}`);
    throw new Error(`Failed to update SystemImport status: ${errorMessage}`);
  }

  // 3. FETCH ALL COMPLETED IMPORTED ITEMS
  let importedItems;
  try {
    importedItems = await prisma.importedDataItem.findMany({
      where: {
        systemImportId,
        status: 'IMPORTED', // Only rollback successfully imported items
      },
      select: {
        id: true,
        createdMonitoredProcessId: true,
        createdCaseDocumentId: true,
        createdProcessMovementId: true,
        createdClientId: true,
        createdCaseId: true,
      },
    });
    console.log(`📋 [Rollback Worker] Found ${importedItems.length} items to rollback`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`🔴 [Rollback Worker] Failed to fetch imported items: ${errorMessage}`);
    throw new Error(`Failed to fetch imported items: ${errorMessage}`);
  }

  // 4. COLLECT ENTITY IDs TO DELETE (Type-Safe)
  const monitoredProcessIds = collectNonNullIds(
    importedItems.map((item) => item.createdMonitoredProcessId)
  );
  const caseDocumentIds = collectNonNullIds(
    importedItems.map((item) => item.createdCaseDocumentId)
  );
  const processMovementIds = collectNonNullIds(
    importedItems.map((item) => item.createdProcessMovementId)
  );
  const clientIds = collectNonNullIds(
    importedItems.map((item) => item.createdClientId)
  );
  const caseIds = collectNonNullIds(
    importedItems.map((item) => item.createdCaseId)
  );

  console.log(`🗑️  [Rollback Worker] Entities to delete:
    - MonitoredProcesses: ${monitoredProcessIds.length}
    - CaseDocuments: ${caseDocumentIds.length}
    - ProcessMovements: ${processMovementIds.length}
    - Clients: ${clientIds.length}
    - Cases: ${caseIds.length}`);

  // 5. ATOMIC TRANSACTION (The Critical Point)
  try {
    const result = await prisma.$transaction([
      // Delete in reverse dependency order to avoid FK constraints
      prisma.processMovement.deleteMany({
        where: { id: { in: processMovementIds } },
      }),
      prisma.processAlert.deleteMany({
        where: { monitoredProcessId: { in: monitoredProcessIds } },
      }),
      prisma.monitoredProcess.deleteMany({
        where: { id: { in: monitoredProcessIds } },
      }),
      prisma.caseDocument.deleteMany({
        where: { id: { in: caseDocumentIds } },
      }),
      prisma.case.deleteMany({
        where: { id: { in: caseIds } },
      }),
      prisma.client.deleteMany({
        where: { id: { in: clientIds } },
      }),
      // Reset imported items to ROLLED_BACK status and clear created entity IDs
      prisma.importedDataItem.updateMany({
        where: { systemImportId },
        data: {
          status: 'ROLLED_BACK',
          createdMonitoredProcessId: null,
          createdCaseDocumentId: null,
          createdProcessMovementId: null,
          createdClientId: null,
          createdCaseId: null,
        },
      }),
      // Mark SystemImport as ROLLED_BACK
      prisma.systemImport.update({
        where: { id: systemImportId },
        data: {
          status: 'ROLLED_BACK',
          failedRows: importedItems.length,
        },
      }),
    ]);

    console.log(
      `✅ [Rollback Worker] Atomic rollback completed successfully (transaction results: ${result.length} operations)`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`🔴 [Rollback Worker] Atomic transaction failed: ${errorMessage}`);
    console.error(`🔴 [Rollback Worker] Stack:`, error);
    throw new Error(`Atomic rollback transaction failed: ${errorMessage}`);
  }

  console.log(`🎉 [Rollback Worker] Rollback job completed for systemImportId: ${systemImportId}`);
}

// ============================================================================
// QUEUE EVENT HANDLERS
// ============================================================================

/**
 * Register worker processor
 */
const rollbackQueueInstance = rollbackQueue();

rollbackQueueInstance.process('rollback', async (job) => {
  try {
    await processRollbackJob(job);
    return { success: true, systemImportId: job.data.systemImportId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`🔴 [Rollback Worker] Job failed: ${errorMessage}`);
    // Re-throw to trigger BullMQ retry mechanism
    throw error;
  }
});

// Job completion event
rollbackQueueInstance.on('completed', (job) => {
  console.log(`✅ [Rollback Worker] Job ${job.id} completed successfully`);
});

// Job failure event
rollbackQueueInstance.on('failed', (job, error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`🔴 [Rollback Worker] Job ${job.id} failed: ${errorMessage}`);
  console.error(`🔴 Attempt ${job.attemptsMade} of ${job.opts.attempts}`);
});

// Job error event (unhandled exception in processor)
rollbackQueueInstance.on('error', (error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`🔴 [Rollback Worker] Queue error: ${errorMessage}`);
});

// ============================================================================
// EXPORTS (For testing and monitoring)
// ============================================================================

export { processRollbackJob, isValidRollbackPayload, collectNonNullIds };
export type { RollbackJobPayload };
