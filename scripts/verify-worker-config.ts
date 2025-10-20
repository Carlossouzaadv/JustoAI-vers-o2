#!/usr/bin/env node

/**
 * ================================================================
 * WORKER CONFIGURATION VERIFICATION SCRIPT
 * ================================================================
 *
 * Verifies that all required environment variables and services
 * are correctly configured for the JUDIT Onboarding Worker.
 *
 * Usage:
 *   npm run verify:worker
 *   or
 *   npx tsx scripts/verify-worker-config.ts
 *
 * This script checks:
 * ✅ Redis connectivity
 * ✅ PostgreSQL connectivity
 * ✅ JUDIT API configuration
 * ✅ Environment variables
 * ✅ Prisma client generation
 *
 */

import dotenv from 'dotenv';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

// ================================================================
// TYPES
// ================================================================

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

// ================================================================
// COLORS FOR OUTPUT
// ================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ================================================================
// CHECK FUNCTIONS
// ================================================================

const checks: { name: string; fn: () => Promise<CheckResult> }[] = [];

// Check 1: NODE_ENV
checks.push({
  name: 'Node Environment',
  fn: async (): Promise<CheckResult> => {
    const env = process.env.NODE_ENV;
    if (!env) {
      return {
        name: 'Node Environment',
        status: 'warning',
        message: 'NODE_ENV not set',
        details: 'Will default to development mode',
      };
    }
    return {
      name: 'Node Environment',
      status: 'pass',
      message: `NODE_ENV: ${env}`,
    };
  },
});

// Check 2: Redis URL
checks.push({
  name: 'Redis Configuration',
  fn: async (): Promise<CheckResult> => {
    const url = process.env.REDIS_URL;
    if (!url) {
      return {
        name: 'Redis Configuration',
        status: 'fail',
        message: 'REDIS_URL not set',
        details: 'Required for job queue. Set REDIS_URL environment variable.',
      };
    }

    // Try to connect
    try {
      const redis = new Redis(url);
      await redis.ping();
      await redis.quit();

      return {
        name: 'Redis Configuration',
        status: 'pass',
        message: `Redis connected successfully`,
        details: `URL: ${url.split('@')[1] || url.substring(0, 20)}...`,
      };
    } catch (error) {
      return {
        name: 'Redis Configuration',
        status: 'fail',
        message: 'Redis connection failed',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Check 3: Database URL
checks.push({
  name: 'PostgreSQL Configuration (pooler)',
  fn: async (): Promise<CheckResult> => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return {
        name: 'PostgreSQL Configuration (pooler)',
        status: 'fail',
        message: 'DATABASE_URL not set',
        details: 'Required for database operations. Set DATABASE_URL environment variable.',
      };
    }

    return {
      name: 'PostgreSQL Configuration (pooler)',
      status: 'pass',
      message: 'DATABASE_URL configured',
      details: `URL: ${url.split('@')[1]?.substring(0, 30) || url.substring(0, 20)}...`,
    };
  },
});

// Check 4: Direct Database URL
checks.push({
  name: 'PostgreSQL Configuration (direct)',
  fn: async (): Promise<CheckResult> => {
    const url = process.env.DIRECT_URL;
    if (!url) {
      return {
        name: 'PostgreSQL Configuration (direct)',
        status: 'warning',
        message: 'DIRECT_URL not set',
        details: 'Required for migrations. Set DIRECT_URL for direct PostgreSQL connection.',
      };
    }

    return {
      name: 'PostgreSQL Configuration (direct)',
      status: 'pass',
      message: 'DIRECT_URL configured',
      details: `URL: ${url.split('@')[1]?.substring(0, 30) || url.substring(0, 20)}...`,
    };
  },
});

// Check 5: JUDIT API Key
checks.push({
  name: 'JUDIT API Configuration',
  fn: async (): Promise<CheckResult> => {
    const key = process.env.JUDIT_API_KEY;
    if (!key) {
      return {
        name: 'JUDIT API Configuration',
        status: 'fail',
        message: 'JUDIT_API_KEY not set',
        details: 'Required for JUDIT API calls. Set JUDIT_API_KEY environment variable.',
      };
    }

    if (key.length < 10) {
      return {
        name: 'JUDIT API Configuration',
        status: 'warning',
        message: 'JUDIT_API_KEY looks suspicious (too short)',
        details: `Key length: ${key.length} characters`,
      };
    }

    return {
      name: 'JUDIT API Configuration',
      status: 'pass',
      message: 'JUDIT_API_KEY configured',
      details: `Key length: ${key.length} characters`,
    };
  },
});

// Check 6: Database Connectivity
checks.push({
  name: 'Database Connectivity Test',
  fn: async (): Promise<CheckResult> => {
    if (!process.env.DATABASE_URL) {
      return {
        name: 'Database Connectivity Test',
        status: 'fail',
        message: 'DATABASE_URL not set - skipping',
      };
    }

    try {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });

      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();

      return {
        name: 'Database Connectivity Test',
        status: 'pass',
        message: 'Database connection successful',
      };
    } catch (error) {
      return {
        name: 'Database Connectivity Test',
        status: 'fail',
        message: 'Database connection failed',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Check 7: Worker Dependencies
checks.push({
  name: 'Worker Dependencies',
  fn: async (): Promise<CheckResult> => {
    try {
      // Try importing key dependencies
      require('bullmq');
      require('@prisma/client');
      require('ioredis');
      require('pino');

      return {
        name: 'Worker Dependencies',
        status: 'pass',
        message: 'All required dependencies installed',
        details: 'bullmq, @prisma/client, ioredis, pino',
      };
    } catch (error) {
      return {
        name: 'Worker Dependencies',
        status: 'fail',
        message: 'Missing required dependencies',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// ================================================================
// RUNNER
// ================================================================

async function runChecks() {
  console.log(colorize('\n' + '='.repeat(70), 'blue'));
  console.log(colorize('  JUDIT Onboarding Worker Configuration Verification', 'bold'));
  console.log(colorize('='.repeat(70) + '\n', 'blue'));

  const results: CheckResult[] = [];

  for (const check of checks) {
    process.stdout.write(`⏳ Checking ${check.name}... `);
    try {
      const result = await check.fn();
      results.push(result);

      const statusIcon =
        result.status === 'pass'
          ? colorize('✅', 'green')
          : result.status === 'fail'
            ? colorize('❌', 'red')
            : colorize('⚠️ ', 'yellow');

      console.log(statusIcon);

      if (result.details) {
        console.log(`   ${result.message}: ${result.details}`);
      }
    } catch (error) {
      console.log(colorize('❌', 'red'));
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        name: check.name,
        status: 'fail',
        message: 'Check failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Summary
  console.log('\n' + colorize('='.repeat(70), 'blue'));

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warnings = results.filter((r) => r.status === 'warning').length;

  console.log(`\n${colorize('Summary:', 'bold')}`);
  console.log(`  ${colorize(`✅ Passed: ${passed}`, 'green')}`);
  console.log(`  ${colorize(`⚠️  Warnings: ${warnings}`, 'yellow')}`);
  console.log(`  ${colorize(`❌ Failed: ${failed}`, 'red')}`);

  console.log('\n' + colorize('='.repeat(70) + '\n', 'blue'));

  if (failed > 0) {
    console.log(
      colorize(
        '❌ Some checks failed. Please fix the issues above before deploying the worker.',
        'red',
      ),
    );
    process.exit(1);
  } else if (warnings > 0) {
    console.log(
      colorize(
        '⚠️  Some warnings detected. Review the details above and address if necessary.',
        'yellow',
      ),
    );
    console.log(colorize('Worker can still run, but may have reduced functionality.\n', 'yellow'));
    process.exit(0);
  } else {
    console.log(
      colorize(
        '✅ All checks passed! Worker is ready for deployment.\n',
        'green',
      ),
    );
    process.exit(0);
  }
}

// ================================================================
// ENTRY POINT
// ================================================================

runChecks().catch((error) => {
  console.error(colorize(`\nFatal error: ${error.message}`, 'red'));
  process.exit(1);
});
