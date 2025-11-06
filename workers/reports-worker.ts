/**
 * Reports Worker - Geração Automática de Relatórios
 *
 * DISABLED: This worker has been disabled as part of cost optimization.
 * The reports queue was removed from @/lib/queues
 *
 * If you need to re-enable this worker:
 * 1. Restore reportsQueue to @/lib/queues
 * 2. Uncomment the processor functions below
 * 3. Deploy to production
 *
 * Restore date: N/A
 * Disable reason: Cost optimization - using Vercel cron jobs instead
 */

import { Job } from 'bull';
// import { reportsQueue } from '@/lib/queues'; // DISABLED: Queue removed for cost optimization
import { prisma } from '@/lib/prisma';
import PDFGenerator from '@/lib/pdf-generator';
import { ReportDataCollector } from '@/lib/report-data-collector';
import { getRedisClient } from '@/lib/redis';
import { addNotificationJob } from '@/lib/queues';
import { addIndividualReportJob } from './individual-reports-worker';
import { ICONS } from '@/lib/icons';

interface ReportsJobData {
  type: 'scheduled' | 'manual' | 'recurring';
  scheduleId?: string;
  workspaceId: string;
  reportType: string;
  filters?: Record<string, unknown>;
  recipients?: string[];
  audienceType?: string;
  outputFormats?: string[];
}

// Placeholder health check function
export async function reportsWorkerHealthCheck() {
  return {
    status: 'disabled',
    message: 'Reports worker has been disabled for cost optimization'
  };
}

console.log(`${ICONS.WORKER} Reports Worker - DISABLED (cost optimization)`);

// Export placeholder to avoid breaking imports
export default undefined;
