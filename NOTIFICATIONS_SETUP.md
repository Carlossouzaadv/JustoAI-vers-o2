# Email & Slack Notifications Setup Guide

**Status:** ✅ Implementation Complete (Nov 2, 2025)
**Services:** `src/lib/email-service.ts`, `src/lib/slack-service.ts`, `src/lib/notification-service.ts`

---

## Overview

JustoAI V2 now has a complete notification system that sends alerts via:
- **Email** - Using Resend API
- **Slack** - Using incoming webhooks
- **Coordinated** - Both channels simultaneously when configured

---

## Prerequisites

You already have:
- ✅ Resend account (or SendGrid/SMTP provider)
- ✅ Basic email configuration in `.env.local`

You need to add:
- 🆕 Slack workspace with admin access
- 🆕 Admin email list for critical alerts

---

## Step 1: Email Setup (Resend)

### Option A: Using Resend (Recommended)

1. **Create Resend Account**
   - Go to https://resend.com/
   - Sign up with your email
   - Verify email address

2. **Get API Key**
   - Dashboard → API Keys → Create API Key
   - Copy the key

3. **Add to `.env.local`**
   ```bash
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_USER=resend
   SMTP_PASSWORD=re_xxxxxxxxxxxxx  # Your Resend API key
   FROM_EMAIL=contato@yourdomain.com
   ADMIN_EMAILS=admin@yourdomain.com,ops@yourdomain.com
   ALERT_EMAIL_ENABLED=true
   ```

4. **Verify Domain** (for production)
   - Resend Dashboard → Domains
   - Add your domain
   - Follow DNS verification steps
   - Update FROM_EMAIL to verified domain

### Option B: Using SendGrid

1. **Create SendGrid Account**
   - Go to https://sendgrid.com/
   - Create account

2. **Get API Key**
   - Settings → API Keys → Create API Key

3. **Add to `.env.local`**
   ```bash
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=SG.xxxxxxxxxxxxxx  # Your SendGrid API key
   FROM_EMAIL=contato@yourdomain.com
   ADMIN_EMAILS=admin@yourdomain.com
   ALERT_EMAIL_ENABLED=true
   ```

### Option C: Using Gmail SMTP

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Generate app-specific password
FROM_EMAIL=your-email@gmail.com
ADMIN_EMAILS=admin@yourdomain.com
ALERT_EMAIL_ENABLED=true
```

---

## Step 2: Slack Setup

### 1. Create Slack App

1. **Go to Slack App Directory**
   - https://api.slack.com/apps
   - Click "Create New App"

2. **Choose "From scratch"**
   - Name: "JustoAI Alerts"
   - Select your workspace

3. **Create Incoming Webhook**
   - Left sidebar → "Incoming Webhooks"
   - Click "Add New Webhook to Workspace"
   - Select channel: `#alerts` (or create new)
   - Authorize

4. **Copy Webhook URL**
   - Format: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`

### 2. Add to Environment

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ALERTS_ENABLED=true
```

### 3. Test Connection

```bash
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"🧪 JustoAI Test Alert"}'
```

---

## Step 3: Configure Admin Emails

```bash
# One or more emails (comma-separated)
ADMIN_EMAILS=admin@yourdomain.com,ops@yourdomain.com,cfo@yourdomain.com
```

These admins will receive:
- Daily JUDIT check summaries
- Critical system alerts
- Job failure alerts

---

## Complete `.env.local` Example

```bash
# ============================================================
# EMAIL CONFIGURATION (Resend)
# ============================================================
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_your_resend_api_key_here
FROM_EMAIL=alerts@yourdomain.com
ADMIN_EMAILS=admin@yourdomain.com,ops@yourdomain.com
ALERT_EMAIL_ENABLED=true

# ============================================================
# SLACK CONFIGURATION
# ============================================================
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ALERTS_ENABLED=true
```

---

## Notification Types

### 1. Job Success Notifications

When a job completes successfully:
- **Email:** Job name + results + timestamp
- **Slack:** Green (🟢) success alert with metrics

**Triggered By:**
- Daily JUDIT Check (success)
- Any scheduled job completion

**Recipients:**
- Admin emails (for critical jobs)
- Console log

### 2. Job Failure Alerts

When a job fails:
- **Email:** Red (🔴) critical alert with error details
- **Slack:** Critical alert with stack trace

**Triggered By:**
- Daily JUDIT Check (error)
- Job scheduler error handler

**Recipients:**
- Admin emails
- Console log

### 3. Daily Check Summary

Every night at 2:00 AM (configurable):
- **Email:** HTML table with statistics
- **Slack:** Alert with success rate and counts

**Statistics:**
- Total processes checked
- Successful checks
- Failed checks
- Processes with new movements
- Execution duration

### 4. Process Alerts

When a legal process has a critical update:
- **Email:** Process number + alert type + urgency
- **Slack:** Color-coded by urgency (high=red, medium=yellow, low=green)

**Usage:**
```typescript
import { sendProcessAlert } from '@/lib/notification-service';

await sendProcessAlert(
  'user@example.com',
  '0000000-00.0000.0.00.0000',
  'DEADLINE_APPROACHING',
  'Prazo processual vence em 3 dias',
  'high'
);
```

### 5. Critical System Alerts

Any critical system error:
- **Email:** Error message + stack trace + context
- **Slack:** Critical severity with error details

**Usage:**
```typescript
import { sendCriticalAlert } from '@/lib/notification-service';

await sendCriticalAlert(
  'Database Connection Failed',
  'Could not connect to database',
  error,
  { 'Database': 'Supabase', 'Retry': 'Needed' }
);
```

---

## API Usage

### Using Notification Service (Recommended)

```typescript
import { getNotificationService } from '@/lib/notification-service';

const notificationService = getNotificationService();

// Send unified notification
await notificationService.sendNotification({
  email: {
    enabled: true,
    recipients: ['user@example.com'],
    template: 'process-alert',
    data: { processNumber, alertType, description }
  },
  slack: {
    enabled: true,
    title: 'Process Alert',
    description: 'Something happened',
    severity: 'warning'
  }
});
```

### Using Helper Functions

```typescript
import {
  sendProcessAlert,
  sendDailyCheckSummary,
  sendCriticalAlert
} from '@/lib/notification-service';

// Send process alert
await sendProcessAlert(
  'user@example.com',
  '000...000',
  'UPDATE',
  'New movement in process',
  'high'
);

// Send daily summary
await sendDailyCheckSummary(
  100,    // total
  95,     // successful
  5,      // failed
  15,     // with new movements
  120000  // duration in ms
);

// Send critical alert
await sendCriticalAlert(
  'Service Down',
  'JUDIT API is unavailable',
  error
);
```

---

## Testing

### Test Email Connection

```bash
node -e "const { getEmailService } = require('./src/lib/email-service'); getEmailService().testConnection().then(console.log);"
```

### Test Slack Connection

```bash
node -e "const { getSlackService } = require('./src/lib/slack-service'); getSlackService().testConnection().then(console.log);"
```

### Simulate Notifications

All notifications work in simulation mode:
- If API key missing → shows warning + simulates success
- No external calls made if not configured
- Safe for development/testing

---

## Monitoring

### Check Email Logs

1. **Resend Dashboard**
   - https://app.resend.com/emails
   - View sent emails
   - Check bounces/failures

2. **SendGrid Dashboard**
   - https://app.sendgrid.com/
   - Activity → Email Activity
   - View delivery status

### Check Slack Integration

1. **Slack App**
   - Workspace → Settings → Manage apps
   - Search "JustoAI Alerts"
   - View activity log

2. **Slack Channel**
   - #alerts channel
   - Verify messages arriving
   - Check formatting

### Console Logs

Development: Check for `[MAIL]` and `[ALERT]` tags:
```
[MAIL] Enviando notificação por email...
[ALERT] Enviando alerta para Slack: Job Success
```

---

## Troubleshooting

### Email Not Sending

**Issue:** Emails silently fail

**Diagnosis:**
1. Check `.env.local` has `SMTP_PASSWORD`
2. Check console for `[MAIL]` logs
3. Verify in Resend/SendGrid dashboard

**Solution:**
```bash
# Test connection
node -e "const { getEmailService } = require('./src/lib/email-service'); getEmailService().testConnection().then(console.log);"

# Expected output: { success: true }
```

### Slack Not Sending

**Issue:** Alerts don't appear in Slack

**Diagnosis:**
1. Check SLACK_WEBHOOK_URL is correct format
2. Verify channel exists
3. Check app permissions

**Solution:**
```bash
# Test webhook
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test"}'

# Expected: Response status 200
```

### Domain Verification Issue (Resend)

**Error:** "Email from unknown domain"

**Solution:**
1. Add domain in Resend dashboard
2. Verify DNS records
3. Update FROM_EMAIL to verified domain

---

## Email Templates

The system includes pre-built HTML templates for:

1. **process-alert** - Process-specific alerts
   ```html
   ┌─────────────────────────────┐
   │  Alerta de Processo         │
   │  Processo: 0000000-00       │
   │  Tipo: DEADLINE_APPROACHING │
   │  Urgência: HIGH             │
   └─────────────────────────────┘
   ```

2. **report-ready** - Report generation complete
   ```html
   ┌─────────────────────────────┐
   │  Relatório Pronto           │
   │  [Download Button]          │
   │  Expira em: [timestamp]     │
   └─────────────────────────────┘
   ```

3. **payment-success** - Payment confirmation
   ```html
   ┌─────────────────────────────┐
   │  Pagamento Confirmado       │
   │  Valor: R$ 100.00           │
   │  Créditos: 1000             │
   └─────────────────────────────┘
   ```

4. **system-notification** - Custom system notifications
   ```html
   ┌─────────────────────────────┐
   │  Notificação do Sistema     │
   │  [Custom message]           │
   │  [Custom details]           │
   └─────────────────────────────┘
   ```

---

## Rate Limiting & Best Practices

### Email Rate Limits

- **Resend Free:** 100 emails/day
- **SendGrid Free:** 100 emails/day
- **Gmail:** 300 emails/day

### Recommendations

1. **Batch Notifications:** Send daily summaries instead of per-process
2. **Throttle Alerts:** Add cooldown for duplicate alerts
3. **Monitor Usage:** Check dashboard regularly
4. **Use Channels:** Email for critical, Slack for info

---

## Next Steps

1. ✅ Set up Resend or SendGrid
2. ✅ Set up Slack webhook
3. ✅ Add to `.env.local`
4. ✅ Test both connections
5. ✅ Monitor first notifications
6. 📊 Adjust templates as needed
7. 🎨 Customize email templates

---

## Support

For issues:
1. Check console logs for `[MAIL]` and `[ALERT]` tags
2. Review service configuration in `.env.local`
3. Test connections using diagnostic commands
4. Check TODO_TRACKER.md for related items

---

**Last Updated:** 2025-11-02
**Maintainer:** Development Team
