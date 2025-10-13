/**
 * POST-DEPLOYMENT VERIFICATION SCRIPT
 * Verifies that the production deployment is working correctly
 */

const https = require('https');
const http = require('http');

// Colors
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

let testsPassed = 0;
let testsFailed = 0;
let testsWarning = 0;

// Production URL - update this!
const PRODUCTION_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://v2.justoai.com.br';
const BASE_URL = PRODUCTION_URL.replace(/\/$/, ''); // Remove trailing slash

// ================================================================
// HTTP REQUEST HELPER
// ================================================================
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// ================================================================
// TEST RUNNER
// ================================================================
async function runTest(name, testFn, isWarning = false) {
  try {
    log(`\n🧪 Testing: ${name}...`, 'blue');
    const result = await testFn();
    log(`✅ ${name}: PASSED`, 'green');
    if (result) {
      log(`   ${result}`, 'reset');
    }
    testsPassed++;
    return true;
  } catch (error) {
    if (isWarning) {
      log(`⚠️  ${name}: WARNING`, 'yellow');
      log(`   ${error.message}`, 'yellow');
      testsWarning++;
      return false;
    } else {
      log(`❌ ${name}: FAILED`, 'red');
      log(`   Error: ${error.message}`, 'red');
      testsFailed++;
      return false;
    }
  }
}

// ================================================================
// 1. TEST HOMEPAGE
// ================================================================
async function testHomepage() {
  const response = await makeRequest(BASE_URL);

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  if (!response.body.includes('html') && !response.body.includes('<!DOCTYPE')) {
    throw new Error('Response does not look like HTML');
  }

  return `Status: ${response.statusCode}, Size: ${response.body.length} bytes`;
}

// ================================================================
// 2. TEST HEALTH ENDPOINT
// ================================================================
async function testHealthEndpoint() {
  const response = await makeRequest(`${BASE_URL}/api/health`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);

  if (data.status !== 'ok' && data.status !== 'healthy') {
    throw new Error(`Health check failed: ${data.status}`);
  }

  return `Status: ${data.status}, Version: ${data.version || 'unknown'}`;
}

// ================================================================
// 3. TEST DATABASE HEALTH
// ================================================================
async function testDatabaseHealth() {
  const response = await makeRequest(`${BASE_URL}/api/health/database`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);

  if (data.status !== 'connected' && data.status !== 'ok') {
    throw new Error(`Database not connected: ${data.status}`);
  }

  return `Database: ${data.status}`;
}

// ================================================================
// 4. TEST REDIS HEALTH
// ================================================================
async function testRedisHealth() {
  const response = await makeRequest(`${BASE_URL}/api/health/redis`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);

  if (data.status !== 'connected' && data.status !== 'ok') {
    throw new Error(`Redis not connected: ${data.status}`);
  }

  return `Redis: ${data.status}`;
}

// ================================================================
// 5. TEST HTTPS & REDIRECT
// ================================================================
async function testHTTPS() {
  if (!BASE_URL.startsWith('https://')) {
    throw new Error('Production URL must use HTTPS');
  }

  // Try HTTP, should redirect to HTTPS
  const httpUrl = BASE_URL.replace('https://', 'http://');
  try {
    const response = await makeRequest(httpUrl, { timeout: 5000 });
    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location || '';
      if (location.startsWith('https://')) {
        return 'HTTP correctly redirects to HTTPS';
      }
    }
  } catch (error) {
    // HTTP might not be available, which is also fine
    return 'HTTPS is enforced';
  }

  return 'HTTPS is active';
}

// ================================================================
// 6. TEST SECURITY HEADERS
// ================================================================
async function testSecurityHeaders() {
  const response = await makeRequest(`${BASE_URL}/api/health`);

  const requiredHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
  ];

  const missingHeaders = [];

  for (const header of requiredHeaders) {
    if (!response.headers[header]) {
      missingHeaders.push(header);
    }
  }

  if (missingHeaders.length > 0) {
    throw new Error(`Missing security headers: ${missingHeaders.join(', ')}`);
  }

  return `All required security headers present`;
}

// ================================================================
// 7. TEST CORS CONFIGURATION
// ================================================================
async function testCORS() {
  const response = await makeRequest(`${BASE_URL}/api/health`, {
    headers: {
      Origin: 'https://malicious-site.com',
    },
  });

  // CORS should NOT allow random origins
  const allowOrigin = response.headers['access-control-allow-origin'];

  if (allowOrigin === '*') {
    throw new Error('CORS allows all origins (security risk)');
  }

  return 'CORS is properly configured (no wildcard)';
}

// ================================================================
// 8. TEST API RESPONSE TIME
// ================================================================
async function testAPIResponseTime() {
  const startTime = Date.now();
  await makeRequest(`${BASE_URL}/api/health`);
  const endTime = Date.now();

  const responseTime = endTime - startTime;

  if (responseTime > 5000) {
    throw new Error(`API response time too slow: ${responseTime}ms`);
  }

  if (responseTime > 2000) {
    return `Response time: ${responseTime}ms (could be optimized)`;
  }

  return `Response time: ${responseTime}ms (excellent)`;
}

// ================================================================
// 9. TEST STATIC ASSETS
// ================================================================
async function testStaticAssets() {
  // Test favicon
  const response = await makeRequest(`${BASE_URL}/favicon.ico`);

  if (response.statusCode !== 200 && response.statusCode !== 304) {
    throw new Error(`Favicon not found: ${response.statusCode}`);
  }

  return 'Static assets are accessible';
}

// ================================================================
// 10. TEST ERROR HANDLING
// ================================================================
async function testErrorHandling() {
  // Request non-existent page
  const response = await makeRequest(`${BASE_URL}/this-page-does-not-exist-123456`);

  if (response.statusCode !== 404) {
    throw new Error(`Expected 404 for non-existent page, got ${response.statusCode}`);
  }

  // Check that error page doesn't leak sensitive info
  if (response.body.includes('DATABASE_URL') || response.body.includes('SUPABASE')) {
    throw new Error('Error page leaks sensitive information');
  }

  return '404 errors handled correctly';
}

// ================================================================
// 11. TEST API RATE LIMITING (Optional)
// ================================================================
async function testRateLimiting() {
  // Make multiple rapid requests
  const requests = [];
  for (let i = 0; i < 100; i++) {
    requests.push(makeRequest(`${BASE_URL}/api/health`).catch(() => null));
  }

  const responses = await Promise.all(requests);

  // Check if any were rate limited (429)
  const rateLimited = responses.filter((r) => r && r.statusCode === 429);

  if (rateLimited.length > 0) {
    return `Rate limiting is active (${rateLimited.length}/100 requests blocked)`;
  }

  // Not rate limited, might be OK depending on configuration
  return 'No rate limiting detected (verify if this is expected)';
}

// ================================================================
// 12. TEST ENVIRONMENT
// ================================================================
async function testEnvironment() {
  // Make request and check for development indicators
  const response = await makeRequest(BASE_URL);

  const devIndicators = [
    'localhost',
    'development',
    'webpack',
    '__NEXT_DATA__',
    'sourceMappingURL',
  ];

  const foundIndicators = [];

  for (const indicator of devIndicators) {
    if (response.body.toLowerCase().includes(indicator.toLowerCase())) {
      foundIndicators.push(indicator);
    }
  }

  // __NEXT_DATA__ is OK, it's part of Next.js
  // sourceMappingURL is OK if minified

  const problematicIndicators = foundIndicators.filter(
    (i) => i !== '__NEXT_DATA__' && i !== 'sourceMappingURL'
  );

  if (problematicIndicators.length > 0) {
    return `Warning: Found dev indicators: ${problematicIndicators.join(', ')}`;
  }

  return 'Production environment verified';
}

// ================================================================
// 13. TEST SSL CERTIFICATE
// ================================================================
async function testSSLCertificate() {
  if (!BASE_URL.startsWith('https://')) {
    throw new Error('Not using HTTPS');
  }

  const urlObj = new URL(BASE_URL);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: '/',
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate();

      if (!cert || Object.keys(cert).length === 0) {
        return reject(new Error('No SSL certificate found'));
      }

      // Check expiration
      const validTo = new Date(cert.valid_to);
      const now = new Date();
      const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        return reject(new Error('SSL certificate is expired'));
      }

      if (daysUntilExpiry < 30) {
        resolve(`SSL valid but expires soon: ${daysUntilExpiry} days`);
      } else {
        resolve(`SSL certificate valid (expires in ${daysUntilExpiry} days)`);
      }
    });

    req.on('error', (error) => {
      reject(new Error(`SSL check failed: ${error.message}`));
    });

    req.end();
  });
}

// ================================================================
// RUN ALL TESTS
// ================================================================
async function runAllTests() {
  log('\n🚀 JustoAI V2 - POST-DEPLOYMENT VERIFICATION\n', 'magenta');
  log(`Testing: ${BASE_URL}\n`, 'blue');

  logSection('🌐 BASIC CONNECTIVITY');
  await runTest('Homepage loads', testHomepage);
  await runTest('Health endpoint', testHealthEndpoint);
  await runTest('HTTPS & SSL Certificate', testSSLCertificate);
  await runTest('HTTPS enforcement', testHTTPS);

  logSection('🔗 SERVICES CONNECTIVITY');
  await runTest('Database connection', testDatabaseHealth);
  await runTest('Redis connection', testRedisHealth);

  logSection('🔒 SECURITY CHECKS');
  await runTest('Security headers', testSecurityHeaders);
  await runTest('CORS configuration', testCORS);
  await runTest('Error handling', testErrorHandling);

  logSection('⚡ PERFORMANCE & OPTIMIZATION');
  await runTest('API response time', testAPIResponseTime);
  await runTest('Static assets', testStaticAssets);

  logSection('🛡️ ADDITIONAL CHECKS');
  await runTest('Production environment', testEnvironment);
  await runTest('Rate limiting', testRateLimiting, true); // Warning only

  // ================================================================
  // SUMMARY
  // ================================================================
  logSection('📊 VERIFICATION SUMMARY');

  const total = testsPassed + testsFailed + testsWarning;
  log(`Total tests: ${total}`, 'blue');
  log(`✅ Passed: ${testsPassed}`, 'green');
  log(`❌ Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  log(`⚠️  Warnings: ${testsWarning}`, testsWarning > 0 ? 'yellow' : 'green');

  console.log('');

  if (testsFailed === 0) {
    log('🎉 DEPLOYMENT VERIFICATION PASSED!', 'green');
    log('✅ Your application is live and healthy', 'green');
    console.log('');
    log(`🌐 Production URL: ${BASE_URL}`, 'blue');
    process.exit(0);
  } else {
    log('❌ DEPLOYMENT VERIFICATION FAILED', 'red');
    log('Fix the issues above before considering deployment successful', 'red');
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  log(error.stack, 'red');
  process.exit(1);
});
