/**
 * Sync Worker - Sincronização com APIs Externas
 *
 * DISABLED: This worker has been disabled as part of cost optimization.
 * The sync queue was removed from @/lib/queues
 *
 * If you need to re-enable this worker:
 * 1. Restore syncQueue to @/lib/queues
 * 2. Uncomment the processor functions below
 * 3. Deploy to production
 *
 * Restore date: N/A
 * Disable reason: Cost optimization - using Vercel cron jobs instead
 */

import { Job } from 'bull';
// import { syncQueue } from '@/lib/queues'; // DISABLED: Queue removed for cost optimization
import { prisma } from '@/lib/prisma';
import { ProcessApiClient, createProcessApiClient } from '@/lib/process-apis';
import { getRedisClient } from '@/lib/redis';
import { ICONS } from '@/lib/icons';

interface SyncJobData {
  type: 'full-sync' | 'incremental-sync' | 'manual-sync';
  processIds?: string[];
  workspaceId?: string;
  force?: boolean;
}

interface SyncResult {
  success: boolean;
  processedCount: number;
  updatedCount: number;
  errorCount: number;
  duration: number;
  errors: Array<{ processId: string; error: string }>;
}

// Placeholder health check function
export async function syncWorkerHealthCheck() {
  return {
    status: 'disabled',
    message: 'Sync worker has been disabled for cost optimization'
  };
}

console.log(`${ICONS.WORKER} Sync Worker - DISABLED (cost optimization)`);

// Export placeholder to avoid breaking imports
export default undefined;
