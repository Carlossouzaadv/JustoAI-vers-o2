# JUDIT Observability - Quick Setup

Quick start guide for the JUDIT integration observability system.

---

## Prerequisites

- PostgreSQL database (via Supabase)
- Redis (for queue metrics - optional)
- JUDIT API Key

---

## Installation

### 1. Install Dependencies

Already installed with the main JUDIT integration:
```bash
npm install pino pino-pretty
```

### 2. Run Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Apply observability migrations
npx prisma migrate dev --name add_observability_models
```

This creates:
- `judit_cost_tracking` table
- `judit_alerts` table

### 3. Configure Alerts (Optional)

Add to `.env.local`:

```bash
# Logging
LOG_LEVEL=info                          # debug, info, warn, error

# Email Alerts
ALERTS_EMAIL_ENABLED=true
ALERTS_EMAIL_FROM=noreply@justoai.com
ALERTS_EMAIL_TO=admin@justoai.com,ops@justoai.com

# Slack Alerts
ALERTS_SLACK_ENABLED=true
ALERTS_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhook Alerts
ALERTS_WEBHOOK_ENABLED=true
ALERTS_WEBHOOK_URL=https://your-service.com/api/alerts
```

---

## Usage

### 1. Automatic Integration

All JUDIT operations (onboarding, monitoring, daily checks) automatically:
- Log structured events
- Record performance metrics
- Track costs
- Send alerts on failures

No manual integration needed!

### 2. Access Observability APIs

#### View Metrics
```bash
curl http://localhost:3000/api/judit/observability/metrics
```

#### View Costs
```bash
curl http://localhost:3000/api/judit/observability/costs
```

#### View Alerts
```bash
curl http://localhost:3000/api/judit/observability/alerts
```

#### Health Check
```bash
curl http://localhost:3000/api/judit/observability/health
```

### 3. View Logs

**Development:**
```bash
npm run dev
# Logs appear in terminal with pretty colors
```

**Production:**
```bash
npm start | pino-pretty
# Or pipe to log aggregation service
```

---

## Features

### Structured Logging
- JSON logs in production
- Pretty logs in development
- Contextual information (CNJ, request IDs, durations)
- Different log levels (debug, info, warn, error)

### Metrics Collection
- API call counts and latencies
- Operation success/failure rates
- Queue statistics
- Rate limiting and circuit breaker events
- Percentiles (p50, p95, p99)

### Cost Tracking
- Real-time cost tracking per operation
- Daily/monthly cost summaries
- Cost breakdown by operation type
- Projected monthly costs
- Cost trend analysis

### Alerting
- API errors
- Rate limits
- Circuit breaker openings
- High cost operations (>R$10)
- Timeouts
- Monitoring failures

---

## Dashboard Integration

### Example React Component

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function JuditMonitoringDashboard() {
  const { data: health } = useQuery({
    queryKey: ['judit-health'],
    queryFn: () =>
      fetch('/api/judit/observability/health').then((r) => r.json()),
    refetchInterval: 30000, // 30 seconds
  });

  const { data: costs } = useQuery({
    queryKey: ['judit-costs'],
    queryFn: () =>
      fetch('/api/judit/observability/costs?days=30').then((r) => r.json()),
    refetchInterval: 60000, // 1 minute
  });

  const { data: alerts } = useQuery({
    queryKey: ['judit-alerts'],
    queryFn: () =>
      fetch('/api/judit/observability/alerts?resolved=false').then((r) =>
        r.json()
      ),
    refetchInterval: 15000, // 15 seconds
  });

  return (
    <div className="space-y-6">
      {/* System Health */}
      <HealthCard status={health?.data?.status} />

      {/* Cost Summary */}
      <CostCard
        todayCost={costs?.data?.summary?.totalCost}
        projectedMonthlyCost={costs?.data?.summary?.projectedMonthlyCost}
        trend={costs?.data?.summary?.costTrend}
      />

      {/* Active Alerts */}
      <AlertsList alerts={alerts?.data?.alerts} />

      {/* Cost Chart */}
      <CostChart data={costs?.data?.dailyCosts} />
    </div>
  );
}
```

---

## Monitoring Checklist

Before going to production:

- [ ] Database migration applied
- [ ] Alert channels configured (Email/Slack/Webhook)
- [ ] LOG_LEVEL set appropriately
- [ ] Health check endpoint accessible
- [ ] Cost tracking verified in database
- [ ] Dashboard displays metrics correctly
- [ ] Alerts being sent successfully
- [ ] Log aggregation configured (CloudWatch, Datadog, etc.)

---

## Quick Test

Test the entire observability stack:

```bash
# 1. Trigger onboarding (will log, track costs, record metrics)
curl -X POST http://localhost:3000/api/judit/onboarding \
  -H "Content-Type: application/json" \
  -d '{"cnj":"1234567-12.2023.8.09.0001"}'

# 2. Check health
curl http://localhost:3000/api/judit/observability/health | jq

# 3. View metrics
curl http://localhost:3000/api/judit/observability/metrics | jq '.data.summary'

# 4. View costs
curl http://localhost:3000/api/judit/observability/costs | jq '.data.summary'

# 5. Check for alerts
curl http://localhost:3000/api/judit/observability/alerts | jq '.data.counts'
```

---

## Troubleshooting

### Logs not appearing
```bash
# Check LOG_LEVEL
echo $LOG_LEVEL

# Set to debug
LOG_LEVEL=debug npm run dev
```

### Metrics returning empty
Metrics are in-memory and cleared every hour. Run some operations first:
```bash
curl -X POST http://localhost:3000/api/judit/onboarding \
  -H "Content-Type: application/json" \
  -d '{"cnj":"1234567-12.2023.8.09.0001"}'
```

### Costs not tracking
Check database connection and migration:
```bash
npx prisma studio
# Look for judit_cost_tracking table
```

### Alerts not sending
Verify configuration:
```bash
# Test Slack webhook
curl -X POST $ALERTS_SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from JustoAI"}'
```

---

## Complete Documentation

See `docs/JUDIT_MONITORING.md` for:
- Detailed architecture
- API reference
- Advanced configuration
- Custom metrics
- Best practices

---

**Status:** ✅ Production Ready
**Last Updated:** 2025-01-10
