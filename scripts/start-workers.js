/**
 * Workers Starter Script
 * Script para inicializar todos os workers Bull Queue
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// === CONFIGURAÇÃO ===

const WORKERS_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    password: process.env.REDIS_PASSWORD || '',
  },
  workers: [
    {
      name: 'sync-worker',
      file: './workers/sync-worker.ts',
      instances: 1,
      enabled: true,
    },
    {
      name: 'reports-worker',
      file: './workers/reports-worker.ts',
      instances: 1,
      enabled: true,
    },
    {
      name: 'cache-cleanup-worker',
      file: './workers/cache-cleanup-worker.ts',
      instances: 1,
      enabled: true,
    },
  ]
};

const LOG_DIR = path.join(__dirname, '..', 'logs', 'workers');
const PID_DIR = path.join(__dirname, '..', 'pids');

// === FUNÇÕES UTILITÁRIAS ===

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function ensureDirectories() {
  [LOG_DIR, PID_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created directory: ${dir}`);
    }
  });
}

function checkRedis() {
  try {
    log('Checking Redis connection...');

    // Tentar conectar com Redis usando ioredis
    const Redis = require('ioredis');
    const redis = new Redis(WORKERS_CONFIG.redis);

    return new Promise((resolve, reject) => {
      redis.ping().then(() => {
        log('✅ Redis connection successful');
        redis.disconnect();
        resolve(true);
      }).catch((error) => {
        log(`❌ Redis connection failed: ${error.message}`);
        redis.disconnect();
        reject(error);
      });
    });

  } catch (error) {
    log(`❌ Redis check failed: ${error.message}`);
    throw error;
  }
}

function startWorker(workerConfig) {
  return new Promise((resolve, reject) => {
    const { name, file, instances } = workerConfig;

    log(`Starting ${instances} instance(s) of ${name}...`);

    for (let i = 0; i < instances; i++) {
      const instanceName = instances > 1 ? `${name}-${i + 1}` : name;
      const logFile = path.join(LOG_DIR, `${instanceName}.log`);
      const pidFile = path.join(PID_DIR, `${instanceName}.pid`);

      try {
        // Usar tsx para executar TypeScript diretamente
        const child = spawn('npx', ['tsx', file], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
          env: {
            ...process.env,
            WORKER_NAME: instanceName,
            WORKER_INSTANCE: i.toString(),
          }
        });

        // Salvar PID
        fs.writeFileSync(pidFile, child.pid.toString());

        // Setup logging
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        child.stdout.on('data', (data) => {
          logStream.write(`[STDOUT] ${data}`);
          if (process.env.DEBUG === 'true') {
            process.stdout.write(`[${instanceName}] ${data}`);
          }
        });

        child.stderr.on('data', (data) => {
          logStream.write(`[STDERR] ${data}`);
          if (process.env.DEBUG === 'true') {
            process.stderr.write(`[${instanceName}] ${data}`);
          }
        });

        child.on('error', (error) => {
          log(`❌ Failed to start ${instanceName}: ${error.message}`);
          reject(error);
        });

        child.on('exit', (code) => {
          log(`🔄 Worker ${instanceName} exited with code ${code}`);

          // Cleanup PID file
          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }

          logStream.end();
        });

        // Unref para permitir que o processo principal termine
        child.unref();

        log(`✅ Started ${instanceName} (PID: ${child.pid})`);

      } catch (error) {
        log(`❌ Error starting ${instanceName}: ${error.message}`);
        reject(error);
      }
    }

    resolve();
  });
}

async function setupRecurringJobs() {
  try {
    log('Setting up recurring jobs...');

    // Importar e executar setup
    const { setupRecurringJobs } = require('../lib/queues');
    await setupRecurringJobs();

    log('✅ Recurring jobs configured');

  } catch (error) {
    log(`❌ Failed to setup recurring jobs: ${error.message}`);
    throw error;
  }
}

function stopWorkers() {
  log('Stopping all workers...');

  const pidFiles = fs.readdirSync(PID_DIR).filter(file => file.endsWith('.pid'));

  pidFiles.forEach(pidFile => {
    try {
      const pidPath = path.join(PID_DIR, pidFile);
      const pid = parseInt(fs.readFileSync(pidPath, 'utf8'));

      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(pidPath);

      log(`✅ Stopped worker (PID: ${pid})`);

    } catch (error) {
      log(`⚠️ Could not stop worker from ${pidFile}: ${error.message}`);
    }
  });
}

function getWorkerStatus() {
  const pidFiles = fs.readdirSync(PID_DIR).filter(file => file.endsWith('.pid'));

  log(`Found ${pidFiles.length} worker PID files`);

  pidFiles.forEach(pidFile => {
    try {
      const pidPath = path.join(PID_DIR, pidFile);
      const pid = parseInt(fs.readFileSync(pidPath, 'utf8'));

      // Check if process is running
      try {
        process.kill(pid, 0); // Doesn't actually kill, just checks
        log(`✅ ${pidFile.replace('.pid', '')}: Running (PID: ${pid})`);
      } catch {
        log(`❌ ${pidFile.replace('.pid', '')}: Not running (Stale PID: ${pid})`);
        fs.unlinkSync(pidPath); // Clean up stale PID file
      }

    } catch (error) {
      log(`⚠️ Error checking ${pidFile}: ${error.message}`);
    }
  });
}

// === SCRIPT PRINCIPAL ===

async function main() {
  const command = process.argv[2];

  log('JustoAI Workers Manager');
  log('======================');

  switch (command) {
    case 'start':
      try {
        ensureDirectories();
        await checkRedis();

        // Parar workers existentes primeiro
        stopWorkers();

        // Iniciar workers
        for (const workerConfig of WORKERS_CONFIG.workers) {
          if (workerConfig.enabled) {
            await startWorker(workerConfig);
          } else {
            log(`⏸️ Skipping disabled worker: ${workerConfig.name}`);
          }
        }

        // Setup jobs recorrentes
        await setupRecurringJobs();

        log('🚀 All workers started successfully!');
        log(`📊 Dashboard: http://localhost:3000/api/admin/queues`);
        log(`📝 Logs: ${LOG_DIR}`);
        log(`🆔 PIDs: ${PID_DIR}`);

      } catch (error) {
        log(`❌ Failed to start workers: ${error.message}`);
        process.exit(1);
      }
      break;

    case 'stop':
      stopWorkers();
      log('🛑 All workers stopped');
      break;

    case 'restart':
      log('🔄 Restarting workers...');
      stopWorkers();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      process.argv[2] = 'start'; // Change command
      await main(); // Recursively call start
      break;

    case 'status':
      getWorkerStatus();
      break;

    case 'logs':
      const workerName = process.argv[3];
      if (workerName) {
        const logFile = path.join(LOG_DIR, `${workerName}.log`);
        if (fs.existsSync(logFile)) {
          execSync(`tail -f ${logFile}`, { stdio: 'inherit' });
        } else {
          log(`❌ Log file not found: ${logFile}`);
        }
      } else {
        log('📝 Available log files:');
        const logFiles = fs.readdirSync(LOG_DIR);
        logFiles.forEach(file => log(`  - ${file}`));
        log('\\nUsage: npm run workers:logs <worker-name>');
      }
      break;

    default:
      log('Usage:');
      log('  npm run workers:start   - Start all workers');
      log('  npm run workers:stop    - Stop all workers');
      log('  npm run workers:restart - Restart all workers');
      log('  npm run workers:status  - Show workers status');
      log('  npm run workers:logs    - Show available logs');
      log('  npm run workers:logs <name> - Tail specific worker log');
      process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\\n🛑 Received SIGINT, stopping workers...');
  stopWorkers();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\\n🛑 Received SIGTERM, stopping workers...');
  stopWorkers();
  process.exit(0);
});

// Run main function
if (require.main === module) {
  main().catch(error => {
    log(`❌ Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  startWorker,
  stopWorkers,
  getWorkerStatus,
  checkRedis,
  setupRecurringJobs,
};