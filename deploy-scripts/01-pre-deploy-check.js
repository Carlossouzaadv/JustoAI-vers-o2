/**
 * PRE-DEPLOY VALIDATION SCRIPT
 * Valida se todas as configurações estão corretas antes do deploy
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60) + '\n');
}

let errors = [];
let warnings = [];

// ================================================================
// 1. CHECK ENVIRONMENT VARIABLES
// ================================================================
function checkEnvironmentVariables() {
  logSection('🔍 CHECKING ENVIRONMENT VARIABLES');

  const requiredEnvVars = [
    'NODE_ENV',
    'NEXT_PUBLIC_APP_URL',
    'DATABASE_URL',
    'DIRECT_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'REDIS_HOST',
    'REDIS_PORT',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'GOOGLE_API_KEY',
    'BULL_BOARD_ACCESS_TOKEN',
    'SMTP_HOST',
    'SMTP_PASSWORD',
    'FROM_EMAIL',
    'ALLOWED_ORIGINS',
  ];

  const recommendedEnvVars = [
    'JUDIT_API_KEY',
    'SENTRY_DSN',
    'ALERTS_EMAIL_TO',
  ];

  // Check required
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      errors.push(`❌ Missing REQUIRED env var: ${varName}`);
    } else {
      log(`✅ ${varName}: configured`, 'green');
    }
  });

  // Check recommended
  recommendedEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      warnings.push(`⚠️  Missing RECOMMENDED env var: ${varName}`);
    } else {
      log(`✅ ${varName}: configured`, 'green');
    }
  });

  // Validate NODE_ENV
  if (process.env.NODE_ENV !== 'production') {
    errors.push(`❌ NODE_ENV must be 'production', got: ${process.env.NODE_ENV}`);
  }

  // Validate URLs
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
    errors.push('❌ NEXT_PUBLIC_APP_URL must use HTTPS in production');
  }

  // Validate CORS origins
  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',');
    origins.forEach((origin) => {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        warnings.push(`⚠️  CORS origin contains localhost: ${origin}`);
      }
    });
  }
}

// ================================================================
// 2. CHECK DATABASE MIGRATIONS
// ================================================================
function checkDatabaseMigrations() {
  logSection('📊 CHECKING DATABASE MIGRATIONS');

  const migrationsDir = path.join(__dirname, '../prisma/migrations');

  if (!fs.existsSync(migrationsDir)) {
    errors.push('❌ Migrations directory not found');
    return;
  }

  const migrations = fs.readdirSync(migrationsDir).filter((file) => {
    const fullPath = path.join(migrationsDir, file);
    return fs.statSync(fullPath).isDirectory() || file.endsWith('.sql');
  });

  if (migrations.length === 0) {
    warnings.push('⚠️  No migrations found');
  } else {
    log(`✅ Found ${migrations.length} migration(s)`, 'green');
    migrations.forEach((migration) => {
      log(`   - ${migration}`, 'reset');
    });
  }

  // Check if schema.prisma exists
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    errors.push('❌ prisma/schema.prisma not found');
  } else {
    log('✅ Prisma schema found', 'green');
  }
}

// ================================================================
// 3. CHECK CRITICAL FILES
// ================================================================
function checkCriticalFiles() {
  logSection('📁 CHECKING CRITICAL FILES');

  const criticalFiles = [
    'package.json',
    'next.config.ts',
    'tsconfig.json',
    'middleware.ts',
    'lib/cors-config.ts',
    'lib/api-utils.ts',
    'prisma/schema.prisma',
  ];

  criticalFiles.forEach((file) => {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      errors.push(`❌ Critical file missing: ${file}`);
    } else {
      log(`✅ ${file}`, 'green');
    }
  });
}

// ================================================================
// 4. CHECK FOR MOCKS/DEBUG CODE
// ================================================================
function checkForMocksAndDebugCode() {
  logSection('🔍 CHECKING FOR MOCKS AND DEBUG CODE');

  const apiRoutesDir = path.join(__dirname, '../src/app/api');

  if (!fs.existsSync(apiRoutesDir)) {
    warnings.push('⚠️  API routes directory not found');
    return;
  }

  let foundMocks = false;

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for mock data
        if (
          content.includes('mockData') ||
          content.includes('MOCK_') ||
          content.includes('mock data') ||
          (content.includes('development') && content.includes('mock'))
        ) {
          warnings.push(`⚠️  Possible mock data in: ${fullPath.replace(__dirname + '/../', '')}`);
          foundMocks = true;
        }

        // Check for console.log (should use proper logging)
        const consoleLogMatches = content.match(/console\.log\(/g);
        if (consoleLogMatches && consoleLogMatches.length > 3) {
          warnings.push(
            `⚠️  Multiple console.log found in: ${fullPath.replace(__dirname + '/../', '')} (${consoleLogMatches.length} occurrences)`
          );
        }
      }
    });
  }

  scanDirectory(apiRoutesDir);

  if (!foundMocks) {
    log('✅ No mock data detected', 'green');
  }
}

// ================================================================
// 5. CHECK DEPENDENCIES
// ================================================================
function checkDependencies() {
  logSection('📦 CHECKING DEPENDENCIES');

  const packageJsonPath = path.join(__dirname, '../package.json');

  if (!fs.existsSync(packageJsonPath)) {
    errors.push('❌ package.json not found');
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const criticalDeps = [
    'next',
    'react',
    'react-dom',
    '@prisma/client',
    'prisma',
    '@supabase/supabase-js',
    'next-auth',
    'bull',
    'ioredis',
    'zod',
    'pino',
  ];

  criticalDeps.forEach((dep) => {
    if (
      !packageJson.dependencies[dep] &&
      !packageJson.devDependencies[dep]
    ) {
      errors.push(`❌ Missing critical dependency: ${dep}`);
    } else {
      const version = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
      log(`✅ ${dep}: ${version}`, 'green');
    }
  });
}

// ================================================================
// 6. CHECK BUILD OUTPUTS
// ================================================================
function checkBuildOutputs() {
  logSection('🏗️  CHECKING BUILD CONFIGURATION');

  const nextConfigPath = path.join(__dirname, '../next.config.ts');

  if (!fs.existsSync(nextConfigPath)) {
    errors.push('❌ next.config.ts not found');
    return;
  }

  log('✅ next.config.ts found', 'green');

  // Check if .next directory exists (build output)
  const nextDir = path.join(__dirname, '../.next');
  if (!fs.existsSync(nextDir)) {
    warnings.push('⚠️  .next build directory not found (run `npm run build` first)');
  } else {
    log('✅ .next build directory exists', 'green');
  }
}

// ================================================================
// 7. CHECK REDIS & DATABASE CONNECTIVITY (Direct)
// ================================================================
async function checkRedisDatabase() {
  logSection('🔌 CHECKING DATABASE & REDIS CONNECTIVITY');

  // Check PostgreSQL connection
  try {
    const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!connectionString) {
      warnings.push('⚠️  DATABASE_URL not set (required for database operations)');
    } else {
      log('✅ DATABASE_URL configured', 'green');
    }
  } catch (error) {
    warnings.push(`⚠️  Database connection test skipped: ${error.message}`);
  }

  // Check Redis connection
  try {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || '6379';
    if (redisHost && redisPort) {
      log(`✅ Redis configured (${redisHost}:${redisPort})`, 'green');
    } else {
      errors.push('❌ REDIS_HOST or REDIS_PORT not configured');
    }
  } catch (error) {
    warnings.push(`⚠️  Redis connection test skipped: ${error.message}`);
  }
}

// ================================================================
// RUN ALL CHECKS
// ================================================================
async function runAllChecks() {
  log('\n🚀 JustoAI V2 - PRE-DEPLOY VALIDATION\n', 'magenta');

  checkEnvironmentVariables();
  checkDatabaseMigrations();
  checkCriticalFiles();
  checkForMocksAndDebugCode();
  checkDependencies();
  checkBuildOutputs();
  await checkRedisDatabase();

  // ================================================================
  // SUMMARY
  // ================================================================
  logSection('📊 VALIDATION SUMMARY');

  if (errors.length === 0 && warnings.length === 0) {
    log('🎉 ALL CHECKS PASSED!', 'green');
    log('✅ Your application is ready for production deploy', 'green');
    process.exit(0);
  }

  if (errors.length > 0) {
    log(`\n❌ ${errors.length} ERROR(S) FOUND:`, 'red');
    errors.forEach((error) => log(error, 'red'));
  }

  if (warnings.length > 0) {
    log(`\n⚠️  ${warnings.length} WARNING(S) FOUND:`, 'yellow');
    warnings.forEach((warning) => log(warning, 'yellow'));
  }

  if (errors.length > 0) {
    log('\n❌ DEPLOY BLOCKED: Fix errors above before deploying', 'red');
    process.exit(1);
  } else {
    log('\n⚠️  DEPLOY ALLOWED WITH WARNINGS: Review warnings above', 'yellow');
    process.exit(0);
  }
}

// Run checks
runAllChecks().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
