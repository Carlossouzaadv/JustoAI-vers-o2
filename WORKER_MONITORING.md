# Worker Monitoring & API Reference

Complete reference for monitoring the JUDIT Onboarding Worker on Railway.

---

## 📊 Monitoring Endpoints

All endpoints are on your **API Service** (`justoai-v2-api`).

### 1. Queue Statistics

```
GET /api/judit/queue/stats
```

**Purpose**: Get real-time queue statistics and health status

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "waiting": 5,           // Jobs waiting to be processed
      "active": 1,            // Jobs currently being processed
      "completed": 250,       // Total jobs completed
      "failed": 2,            // Total jobs failed
      "delayed": 0,           // Jobs delayed
      "health": "healthy"     // "healthy" | "warning" | "critical"
    },
    "activeJobs": [
      {
        "jobId": "onboard-0012345678-1729400000000",
        "cnj": "0012345-67.2024.1.01.2345",
        "progress": 50,        // 0-100
        "processedOn": 1729400100000
      }
    ],
    "waitingJobs": [
      {
        "jobId": "onboard-0087654321-1729400001000",
        "cnj": "0087654-32.2024.1.01.7654",
        "priority": 5,
        "timestamp": 1729400101000
      }
    ],
    "timestamp": "2025-10-20T01:00:00.000Z"
  }
}
```

**Health Status**:
- ✅ `healthy` - Everything normal
- ⚠️ `warning` - Many jobs waiting (100+) or active (20+)
- ❌ `critical` - Many failed jobs (50+)

**Example Usage**:
```bash
curl https://your-api.railway.app/api/judit/queue/stats | jq '.data.stats'
```

---

### 2. Job Status

```
GET /api/judit/onboarding/status/:jobId
```

**Purpose**: Check status of a specific job

**Parameters**:
- `jobId` (string, required) - Job ID from upload response

**Response**:
```json
{
  "success": true,
  "data": {
    "jobId": "onboard-0012345678-1729400000000",
    "status": "completed",                  // waiting | active | completed | failed | delayed
    "statusDescription": "Concluído",       // Human-readable
    "progress": 100,                        // 0-100
    "result": {
      "success": true,
      "processoId": "12345678",
      "requestId": "req-abc123def456",
      "numeroCnj": "0012345-67.2024.1.01.2345",
      "duration": 15000                     // milliseconds
    },
    "error": null,
    "isComplete": true,
    "isFailed": false
  }
}
```

**Example Usage**:
```bash
# Get job status
JOB_ID="onboard-0012345678-1729400000000"
curl https://your-api.railway.app/api/judit/onboarding/status/$JOB_ID

# Or with jq
curl https://your-api.railway.app/api/judit/onboarding/status/$JOB_ID | jq '.data.status'
```

---

### 3. API Health

```
GET /api/health
```

**Purpose**: Verify API is running and database is accessible

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-20T01:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

**Example Usage**:
```bash
curl https://your-api.railway.app/api/health | jq '.status'
```

---

## 🔍 Monitoring Workflow

### Real-Time Monitoring (Manual)

```bash
#!/bin/bash
# Monitor queue every 5 seconds

API_URL="https://your-api.railway.app"

while true; do
  clear
  echo "=== Queue Status ==="
  curl -s "$API_URL/api/judit/queue/stats" | jq '.data.stats'
  echo ""
  echo "=== Active Jobs ==="
  curl -s "$API_URL/api/judit/queue/stats" | jq '.data.activeJobs[]'
  echo ""
  echo "Press Ctrl+C to exit"
  sleep 5
done
```

### Check Specific Job

```bash
#!/bin/bash
# Wait for job completion

JOB_ID="$1"
API_URL="https://your-api.railway.app"
MAX_WAIT=300  # 5 minutes

echo "Monitoring job: $JOB_ID"

for i in $(seq 1 $MAX_WAIT); do
  STATUS=$(curl -s "$API_URL/api/judit/onboarding/status/$JOB_ID" | jq -r '.data.status')

  case $STATUS in
    "completed")
      echo "✅ Job completed!"
      curl -s "$API_URL/api/judit/onboarding/status/$JOB_ID" | jq '.data'
      exit 0
      ;;
    "failed")
      echo "❌ Job failed!"
      curl -s "$API_URL/api/judit/onboarding/status/$JOB_ID" | jq '.data'
      exit 1
      ;;
    "active")
      echo "⏳ Processing... ($i seconds)"
      ;;
    *)
      echo "⏳ Status: $STATUS ($i seconds)"
      ;;
  esac

  sleep 1
done

echo "❌ Job did not complete within $MAX_WAIT seconds"
exit 1
```

---

## 📈 Key Metrics to Monitor

### Queue Health Indicators

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Waiting Jobs | 0-10 | 10-100 | 100+ |
| Active Jobs | 0-3 | 3-20 | 20+ |
| Failed Jobs | 0-1 | 1-50 | 50+ |
| Avg Processing Time | < 30s | 30-60s | 60s+ |
| Health Status | healthy | warning | critical |

### Example Dashboard Script

```bash
#!/bin/bash
# Comprehensive health dashboard

API_URL="https://your-api.railway.app"

echo "=== JustoAI Worker Health Dashboard ==="
echo "Time: $(date)"
echo ""

# Get stats
STATS=$(curl -s "$API_URL/api/judit/queue/stats" | jq '.data.stats')

WAITING=$(echo "$STATS" | jq '.waiting')
ACTIVE=$(echo "$STATS" | jq '.active')
COMPLETED=$(echo "$STATS" | jq '.completed')
FAILED=$(echo "$STATS" | jq '.failed')
HEALTH=$(echo "$STATS" | jq -r '.health')

echo "Queue Status: $HEALTH"
echo ""
echo "Jobs:"
echo "  Waiting:   $WAITING"
echo "  Active:    $ACTIVE"
echo "  Completed: $COMPLETED"
echo "  Failed:    $FAILED"
echo ""

# Health verdict
if [ "$HEALTH" = "healthy" ]; then
  echo "✅ System is healthy"
elif [ "$HEALTH" = "warning" ]; then
  echo "⚠️  System has warnings - check metrics above"
else
  echo "❌ System is in critical state - investigate immediately"
fi
```

---

## 🚨 Alerts to Set Up

### Via Railway Notifications

Go to: **Project Settings → Alerts**

Create alerts for:

1. **Worker Service Unavailable**
   - Alert: Service crashes or stops
   - Action: Restart + notify team

2. **High CPU Usage**
   - Alert: CPU > 80% for 5 minutes
   - Action: Check worker logs

3. **High Memory Usage**
   - Alert: Memory > 90% for 5 minutes
   - Action: Increase memory or restart

4. **Failed Deployments**
   - Alert: Deployment fails
   - Action: Check logs and rollback if needed

### Via API Polling (Recommended)

```typescript
// In your backend, run this check periodically (every 5 minutes)

async function checkWorkerHealth() {
  const response = await fetch(
    `https://your-api.railway.app/api/judit/queue/stats`
  );
  const data = await response.json();

  const { waiting, active, failed } = data.data.stats;

  // Alert conditions
  if (failed > 50) {
    await sendAlert('❌ CRITICAL: 50+ jobs failed', 'critical');
  } else if (waiting > 100) {
    await sendAlert('⚠️  WARNING: 100+ jobs waiting', 'warning');
  } else if (active === 0 && waiting > 0) {
    // Worker crashed but hasn't been restarted yet
    await sendAlert('⚠️  WARNING: Jobs waiting but worker not active', 'warning');
  }
}
```

---

## 📋 Troubleshooting with Endpoints

### Worker Not Picking Up Jobs

```bash
# 1. Check queue stats
curl https://your-api.railway.app/api/judit/queue/stats | jq '.'

# Expected: waiting > 0, active > 0 (or should become active soon)
# Problem: active = 0 and waiting > 0
```

**What to check**:
1. Worker service is running: `railway logs -s justoai-v2-workers`
2. Redis connection: Look for "Redis connected" in logs
3. Worker crashed: Look for error messages

### Job Stuck in Processing

```bash
# 1. Get job status
JOB_ID="onboard-0012345678-1729400000000"
curl https://your-api.railway.app/api/judit/onboarding/status/$JOB_ID | jq '.'

# Expected: status changes from "active" to "completed"
# Problem: status stays "active" for 30+ minutes
```

**What to do**:
1. Check worker logs for the job ID
2. Look for "fase2" logs (attachment processing)
3. If stuck, restart worker service

### High Failed Job Rate

```bash
# 1. Check stats
curl https://your-api.railway.app/api/judit/queue/stats | jq '.data.stats'

# Expected: failed < 2
# Problem: failed > 50
```

**What to check**:
1. Worker logs: `railway logs -s justoai-v2-workers | grep failed`
2. JUDIT API status: Is API responding?
3. Database connection: Is database accessible?

---

## 🔗 Integration Examples

### Node.js/TypeScript

```typescript
import axios from 'axios';

const API_URL = process.env.API_URL || 'https://your-api.railway.app';

// Get queue stats
async function getQueueStats() {
  const response = await axios.get(`${API_URL}/api/judit/queue/stats`);
  return response.data.data.stats;
}

// Get job status
async function getJobStatus(jobId: string) {
  const response = await axios.get(
    `${API_URL}/api/judit/onboarding/status/${jobId}`
  );
  return response.data.data;
}

// Example: Wait for job completion
async function waitForJobCompletion(jobId: string, timeout = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const job = await getJobStatus(jobId);

    if (job.isComplete) {
      return job.result;
    }

    if (job.isFailed) {
      throw new Error(`Job failed: ${job.error}`);
    }

    console.log(`Job ${jobId} progress: ${job.progress}%`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Job did not complete within ${timeout}ms`);
}
```

### Python

```python
import requests
import time

API_URL = "https://your-api.railway.app"

def get_queue_stats():
    response = requests.get(f"{API_URL}/api/judit/queue/stats")
    return response.json()["data"]["stats"]

def get_job_status(job_id):
    response = requests.get(f"{API_URL}/api/judit/onboarding/status/{job_id}")
    return response.json()["data"]

# Example: Wait for job completion
def wait_for_job(job_id, timeout=300):
    start_time = time.time()

    while time.time() - start_time < timeout:
        job = get_job_status(job_id)

        if job["isComplete"]:
            return job["result"]

        if job["isFailed"]:
            raise Exception(f"Job failed: {job['error']}")

        print(f"Job {job_id} progress: {job['progress']}%")
        time.sleep(1)

    raise TimeoutError(f"Job did not complete within {timeout} seconds")
```

---

## 📞 Support

### Getting Logs

```bash
# Railway CLI
railway logs -s justoai-v2-workers

# Follow in real-time
railway logs -s justoai-v2-workers -f

# Last 100 lines
railway logs -s justoai-v2-workers | tail -100

# Filter by keyword
railway logs -s justoai-v2-workers | grep "job_completed"
```

### Restart Worker

```bash
# Via Railway CLI
railway deploy -s justoai-v2-workers

# Or via UI: Railway → justoai-v2-workers → Restart
```

---

**Last Updated**: 2025-10-20
