// ================================================================
// JOB LOGGER - Structured logging for background jobs
// ================================================================

import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'retrying' | 'cancelled' | 'timeout';
export type JobType =
  | 'report_scheduler'
  | 'judit_check'
  | 'webhook_retry'
  | 'batch_import'
  | 'process_monitor'
  | 'attachment_download'
  | 'analysis_job'
  | 'cleanup';

interface JobLogEntry {
  jobId: string;
  jobType: JobType;
  workspaceId: string;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  errorStack?: string;
  retryCount: number;
  maxRetries: number;
  tags: string[];
  metrics?: {
    itemsProcessed?: number;
    itemsFailed?: number;
    successRate?: number;
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
  };
}

export class JobLogger {
  private logs: Map<string, JobLogEntry> = new Map();
  private readonly MAX_LOGS = 1000;

  /**
   * Log job start
   */
  logStart(
    jobId: string,
    jobType: JobType,
    workspaceId: string,
    input?: Record<string, unknown>,
    tags: string[] = []
  ): JobLogEntry {
    const log: JobLogEntry = {
      jobId,
      jobType,
      workspaceId,
      status: 'running',
      startedAt: new Date(),
      input,
      retryCount: 0,
      maxRetries: 3,
      tags: [`[${jobType}]`, ...tags],
    };

    this.logs.set(jobId, log);
    this.pruneOldLogs();

    console.log(
      `${ICONS.PROCESS} Job started: ${jobType}`,
      {
        jobId: jobId.substring(0, 8),
        workspace: workspaceId.substring(0, 8),
        tags: tags.join(', '),
        input: input ? Object.keys(input).join(', ') : 'none',
      }
    );

    return log;
  }

  /**
   * Log job progress
   */
  logProgress(
    jobId: string,
    message: string,
    metrics?: Partial<JobLogEntry['metrics']>
  ): void {
    const log = this.logs.get(jobId);
    if (!log) return;

    if (metrics) {
      log.metrics = { ...log.metrics, ...metrics };
    }

    const elapsed = Date.now() - log.startedAt.getTime();
    console.log(
      `${ICONS.INFO} Job progress: ${log.jobType}`,
      {
        jobId: jobId.substring(0, 8),
        message,
        elapsed: `${elapsed}ms`,
        metrics,
      }
    );
  }

  /**
   * Log job completion
   */
  logSuccess(
    jobId: string,
    output?: Record<string, unknown>,
    metrics?: Partial<JobLogEntry['metrics']>
  ): void {
    const log = this.logs.get(jobId);
    if (!log) return;

    log.status = 'success';
    log.completedAt = new Date();
    log.duration = Date.now() - log.startedAt.getTime();
    log.output = output;
    log.metrics = { ...log.metrics, ...metrics };

    console.log(
      `${ICONS.SUCCESS} Job completed: ${log.jobType}`,
      {
        jobId: jobId.substring(0, 8),
        duration: `${log.duration}ms`,
        output: output ? Object.keys(output).join(', ') : 'none',
        metrics,
      }
    );
  }

  /**
   * Log job failure
   */
  logFailure(
    jobId: string,
    error: Error | string,
    retryCount: number = 0,
    maxRetries: number = 3
  ): void {
    const log = this.logs.get(jobId);
    if (!log) return;

    const shouldRetry = retryCount < maxRetries;
    log.status = shouldRetry ? 'retrying' : 'failed';
    log.completedAt = new Date();
    log.duration = Date.now() - log.startedAt.getTime();
    log.error = error instanceof Error ? error.message : String(error);
    log.errorStack = error instanceof Error ? error.stack : undefined;
    log.retryCount = retryCount;
    log.maxRetries = maxRetries;

    console.error(
      `${ICONS.ERROR} Job ${shouldRetry ? 'retrying' : 'failed'}: ${log.jobType}`,
      {
        jobId: jobId.substring(0, 8),
        attempt: `${retryCount + 1}/${maxRetries + 1}`,
        duration: `${log.duration}ms`,
        error: log.error,
        stack: log.errorStack?.split('\n').slice(0, 3).join('\n'),
      }
    );
  }

  /**
   * Log job timeout
   */
  logTimeout(jobId: string, timeoutMs: number): void {
    const log = this.logs.get(jobId);
    if (!log) return;

    log.status = 'timeout';
    log.completedAt = new Date();
    log.duration = Date.now() - log.startedAt.getTime();
    log.error = `Job timeout after ${timeoutMs}ms`;

    console.warn(
      `${ICONS.WARNING} Job timeout: ${log.jobType}`,
      {
        jobId: jobId.substring(0, 8),
        timeout: `${timeoutMs}ms`,
        duration: `${log.duration}ms`,
      }
    );
  }

  /**
   * Log job cancellation
   */
  logCancellation(jobId: string, reason?: string): void {
    const log = this.logs.get(jobId);
    if (!log) return;

    log.status = 'cancelled';
    log.completedAt = new Date();
    log.duration = Date.now() - log.startedAt.getTime();
    log.error = reason || 'Job cancelled by user';

    console.log(
      `${ICONS.WARNING} Job cancelled: ${log.jobType}`,
      {
        jobId: jobId.substring(0, 8),
        reason,
        duration: `${log.duration}ms`,
      }
    );
  }

  /**
   * Get job log entry
   */
  getLog(jobId: string): JobLogEntry | undefined {
    return this.logs.get(jobId);
  }

  /**
   * Get logs for a workspace
   */
  getWorkspaceLogs(workspaceId: string, limit: number = 100): JobLogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.workspaceId === workspaceId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get logs for a job type
   */
  getJobTypeLogs(jobType: JobType, limit: number = 100): JobLogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.jobType === jobType)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get logs by status
   */
  getLogsByStatus(status: JobStatus, limit: number = 100): JobLogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.status === status)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get summary statistics
   */
  getSummary(timeWindowMs: number = 60 * 60 * 1000): {
    totalJobs: number;
    successRate: number;
    avgDuration: number;
    failureCount: number;
    byType: Record<JobType, number>;
  } {
    const now = Date.now();
    const recentLogs = Array.from(this.logs.values()).filter(
      log => now - log.startedAt.getTime() < timeWindowMs
    );

    const successCount = recentLogs.filter(l => l.status === 'success').length;
    const failureCount = recentLogs.filter(l => l.status === 'failed').length;
    const avgDuration = recentLogs.length > 0
      ? recentLogs.reduce((sum, l) => sum + (l.duration || 0), 0) / recentLogs.length
      : 0;

    const byType: Record<JobType, number> = {} as Record<JobType, number>;
    for (const log of recentLogs) {
      byType[log.jobType] = (byType[log.jobType] || 0) + 1;
    }

    return {
      totalJobs: recentLogs.length,
      successRate: recentLogs.length > 0 ? (successCount / recentLogs.length) * 100 : 0,
      avgDuration,
      failureCount,
      byType,
    };
  }

  /**
   * Prune old logs to prevent memory bloat
   */
  private pruneOldLogs(): void {
    if (this.logs.size > this.MAX_LOGS) {
      const toDelete = this.logs.size - Math.floor(this.MAX_LOGS * 0.8);
      const sorted = Array.from(this.logs.entries())
        .sort((a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime())
        .slice(0, toDelete);

      for (const [jobId] of sorted) {
        this.logs.delete(jobId);
      }

      log.info({ msg: 'Pruned  old job logs' });
    }
  }

  /**
   * Clear all logs (use with caution)
   */
  clear(): void {
    this.logs.clear();
    log.info({ msg: 'Cleared all job logs' });
  }
}

// Singleton instance
export const jobLogger = new JobLogger();
