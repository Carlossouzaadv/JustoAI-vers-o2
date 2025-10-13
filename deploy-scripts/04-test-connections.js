/**
 * CONNECTION TESTING SCRIPT
 * Testa todas as conexões críticas antes do deploy
 */

const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const nodemailer = require('nodemailer');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60) + '\n');
}

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, testFn) {
  try {
    log(`\n🧪 Testing: ${name}...`, 'blue');
    await testFn();
    log(`✅ ${name}: PASSED`, 'green');
    testsPassed++;
  } catch (error) {
    log(`❌ ${name}: FAILED`, 'red');
    log(`   Error: ${error.message}`, 'red');
    testsFailed++;
  }
}

// ================================================================
// 1. TEST DATABASE CONNECTION
// ================================================================
async function testDatabase() {
  const prisma = new PrismaClient();

  try {
    // Test connection
    await prisma.$connect();
    log('   - Connection successful', 'green');

    // Test query
    const userCount = await prisma.user.count();
    log(`   - Query successful (${userCount} users)`, 'green');

    // Test critical tables exist
    const workspaceCount = await prisma.workspace.count();
    log(`   - Workspace table accessible (${workspaceCount} workspaces)`, 'green');

    const processCount = await prisma.processo.count();
    log(`   - JUDIT tables accessible (${processCount} processos)`, 'green');

  } finally {
    await prisma.$disconnect();
  }
}

// ================================================================
// 2. TEST REDIS CONNECTION
// ================================================================
async function testRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 1,
  });

  try {
    // Test ping
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Invalid ping response');
    }
    log('   - Ping successful', 'green');

    // Test set/get
    await redis.set('test:connection', 'ok', 'EX', 10);
    const value = await redis.get('test:connection');
    if (value !== 'ok') {
      throw new Error('Set/Get test failed');
    }
    log('   - Set/Get successful', 'green');

    // Test keys
    const keys = await redis.keys('bull:*');
    log(`   - Bull queue keys found: ${keys.length}`, 'green');

  } finally {
    await redis.quit();
  }
}

// ================================================================
// 3. TEST EMAIL SERVICE
// ================================================================
async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Verify connection
  await transporter.verify();
  log('   - SMTP connection verified', 'green');

  // Note: Not sending test email to avoid spam
  log('   - Email service ready (not sending test email)', 'green');
}

// ================================================================
// 4. TEST SUPABASE
// ================================================================
async function testSupabase() {
  const { createClient } = require('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Test health endpoint
  const { data, error } = await supabase.from('users').select('count').limit(1);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  log('   - Supabase connection successful', 'green');
  log('   - Query executed successfully', 'green');
}

// ================================================================
// 5. TEST JUDIT API (if configured)
// ================================================================
async function testJuditAPI() {
  if (!process.env.JUDIT_API_KEY) {
    log('   - JUDIT_API_KEY not configured, skipping', 'yellow');
    throw new Error('JUDIT_API_KEY not configured');
  }

  const fetch = require('node-fetch');

  // Test requests endpoint
  const response = await fetch(`${process.env.JUDIT_REQUESTS_URL}/health`, {
    method: 'GET',
    headers: {
      'api-key': process.env.JUDIT_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`JUDIT API returned ${response.status}`);
  }

  log('   - JUDIT API connection successful', 'green');
}

// ================================================================
// 6. TEST ENVIRONMENT VARIABLES
// ================================================================
async function testEnvironmentVariables() {
  const required = [
    'NODE_ENV',
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXTAUTH_SECRET',
    'REDIS_HOST',
    'SMTP_HOST',
    'SMTP_PASSWORD',
  ];

  const missing = [];

  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  log(`   - All ${required.length} required variables present`, 'green');

  // Check NODE_ENV
  if (process.env.NODE_ENV !== 'production') {
    log(`   ⚠️  NODE_ENV is not 'production': ${process.env.NODE_ENV}`, 'yellow');
  }
}

// ================================================================
// 7. TEST API KEYS
// ================================================================
async function testAPIKeys() {
  const keys = {
    'Google API Key': process.env.GOOGLE_API_KEY,
    'JUDIT API Key': process.env.JUDIT_API_KEY,
    'Sentry DSN': process.env.SENTRY_DSN,
  };

  for (const [name, value] of Object.entries(keys)) {
    if (value) {
      log(`   - ${name}: configured`, 'green');
    } else {
      log(`   - ${name}: not configured`, 'yellow');
    }
  }

  // Check NextAuth secret length
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters');
  }

  log('   - NEXTAUTH_SECRET: valid length', 'green');
}

// ================================================================
// RUN ALL TESTS
// ================================================================
async function runAllTests() {
  log('\n🚀 JustoAI V2 - CONNECTION TESTING\n', 'blue');

  await runTest('Environment Variables', testEnvironmentVariables);
  await runTest('Database (Prisma)', testDatabase);
  await runTest('Redis', testRedis);
  await runTest('Supabase', testSupabase);
  await runTest('Email Service (SMTP)', testEmail);
  await runTest('API Keys', testAPIKeys);
  await runTest('JUDIT API', testJuditAPI);

  // ================================================================
  // SUMMARY
  // ================================================================
  logSection('📊 TESTING SUMMARY');

  const total = testsPassed + testsFailed;
  log(`Total tests: ${total}`, 'blue');
  log(`✅ Passed: ${testsPassed}`, 'green');
  log(`❌ Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');

  if (testsFailed === 0) {
    log('\n🎉 ALL TESTS PASSED!', 'green');
    log('✅ All connections are working correctly', 'green');
    process.exit(0);
  } else {
    log('\n❌ SOME TESTS FAILED', 'red');
    log('Fix the issues above before deploying', 'red');
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
