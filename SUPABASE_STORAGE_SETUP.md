# Supabase Storage Setup Guide

**Status:** ✅ Implementation Complete (Nov 2, 2025)
**Service:** `src/lib/services/supabaseStorageService.ts`

---

## Overview

JustoAI V2 now uses **Supabase Storage** for permanent file storage instead of ephemeral `/tmp` directories. This ensures:
- Files persist across deployments
- Automatic backups via Supabase
- Cost-effective storage included with Supabase
- Integrated with your existing Supabase database

---

## Prerequisites

- ✅ Supabase account (you already have this)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (already configured)
- `NEXT_PUBLIC_SUPABASE_URL` must be set (already configured)

---

## Step 1: Create Storage Buckets

1. Go to **[Supabase Dashboard](https://app.supabase.com)** → Your Project
2. Navigate to **Storage** (left sidebar)
3. Click **"New Bucket"** and create these 3 buckets:

### Bucket 1: case-documents
- **Name:** `case-documents`
- **Visibility:** Public (users need to download PDFs)
- **File size limit:** 100MB
- **Purpose:** Original PDFs uploaded by users

```sql
-- Supabase RLS Policy (optional, for fine-grained access)
-- Allow authenticated users to read their workspace documents
CREATE POLICY "Allow authenticated users to read case documents"
ON storage.objects FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND bucket_id = 'case-documents'
);
```

### Bucket 2: case-attachments
- **Name:** `case-attachments`
- **Visibility:** Private (internal system use)
- **File size limit:** 50MB
- **Purpose:** Files downloaded from JUDIT API

```sql
-- Supabase RLS Policy
CREATE POLICY "Allow authenticated users to read attachments"
ON storage.objects FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND bucket_id = 'case-attachments'
);
```

### Bucket 3: reports
- **Name:** `reports`
- **Visibility:** Private (only authenticated users)
- **File size limit:** 50MB
- **Purpose:** Generated reports (PDF, DOCX, Excel)

```sql
-- Supabase RLS Policy
CREATE POLICY "Allow authenticated users to read reports"
ON storage.objects FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND bucket_id = 'reports'
);
```

---

## Step 2: Verify Environment Variables

Check your `.env.local` file:

```bash
# These should already be set
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here  # ← Critical for uploads
```

**⚠️ Important:**
- `SUPABASE_SERVICE_ROLE_KEY` is used by the server for uploads (never expose to frontend)
- Already in `.env.example` - just populate from Supabase dashboard
- Get it from: **Settings** → **API** → **Service Role Secret** (copy if already created, or generate new)

---

## Step 3: Test the Integration

### Manual Test

```bash
# Start development server
npm run dev

# Upload a PDF at http://localhost:3000
# Check browser DevTools → Network to see upload requests
```

### Verification in Supabase Dashboard

1. Go to **Storage** → **case-documents**
2. You should see uploaded files organized as:
   ```
   workspace-id/
     └── case-id/
           └── 1730500000000-document-name.pdf
   ```
3. Click file to get public URL (will work for public bucket)

---

## File Organization Structure

All files are organized by workspace and case for easy management:

```
Storage Bucket Structure:
├── case-documents/
│   ├── ws_abc123/
│   │   ├── case_123/
│   │   │   ├── 1730500000000-contract.pdf
│   │   │   └── 1730500001000-agreement.pdf
│   │   └── case_456/
│   │       └── 1730500002000-motion.pdf
│   └── ws_xyz789/
│       └── case_789/
│           └── 1730500003000-complaint.pdf
│
├── case-attachments/
│   └── [Same structure as above]
│
└── reports/
    └── [Same structure as above]
```

---

## API Usage Examples

### Upload a Case Document (Automatic)

When you upload a PDF via `/api/process/upload` or `/api/documents/upload`, it automatically:

```typescript
// Inside route.ts
const permanentUrl = await uploadCaseDocument(
  workspaceId,
  caseId,
  fileName,
  buffer,
  mimeType
);
// Returns: https://your-project.supabase.co/storage/v1/object/public/case-documents/...
```

### Upload a Report

```typescript
import { uploadReport } from '@/lib/services/supabaseStorageService';

const reportUrl = await uploadReport(
  workspaceId,
  caseId,
  'pdf', // or 'docx', 'excel'
  pdfBuffer,
  'Monthly Report'
);
```

### Upload an Attachment

```typescript
import { uploadAttachment } from '@/lib/services/supabaseStorageService';

const attachmentUrl = await uploadAttachment(
  workspaceId,
  caseId,
  'judgment-order.pdf',
  fileBuffer,
  'application/pdf'
);
```

### Delete a File

```typescript
import { deleteFromStorage, STORAGE_BUCKETS } from '@/lib/services/supabaseStorageService';

await deleteFromStorage(
  STORAGE_BUCKETS.CASE_DOCUMENTS,
  'ws_abc123/case_123/1730500000000-contract.pdf'
);
```

---

## Monitoring & Costs

### Check Storage Usage

1. **Supabase Dashboard** → **Storage** → Overview
2. Shows:
   - Total storage used
   - Files per bucket
   - Average file size

### Cost Estimation

Supabase Storage pricing (included in free tier):
- **Free Plan:** 1GB per project
- **Pro Plan:** $25/month + $0.025 per GB over 100GB

**Typical JustoAI V2 Usage:**
- ~100KB per PDF document
- ~10,000 documents = ~1GB storage
- **Cost:** Covered by Pro plan

---

## Troubleshooting

### Files Not Appearing in Storage

**Issue:** Upload completes but files don't appear in Supabase dashboard

**Solution:**
1. Check `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`
2. Verify buckets were created with exact names (case-sensitive):
   - `case-documents`
   - `case-attachments`
   - `reports`
3. Check server logs for upload errors:
   ```bash
   tail -f ~/.pm2/logs/app-out.log  # Production
   # or in dev:
   npm run dev  # Check console output
   ```

### "Cannot find module '@/lib/icons'" Error

**Solution:** Ensure imports use proper path aliases. Already fixed in codebase.

### CORS Errors When Accessing Public Files

**Solution:**
1. Make sure `case-documents` bucket is set to **Public**
2. Other buckets should be **Private** with RLS policies
3. Test from browser: `https://your-project.supabase.co/storage/v1/object/public/case-documents/...`

### Service Role Key Missing

**Error:** `"Missing Supabase environment variables"`

**Solution:**
```bash
# Get from Supabase Dashboard:
# Settings → API → Service Role Secret (copy it)
# Add to .env.local:
SUPABASE_SERVICE_ROLE_KEY=your-key-here

# Restart server
npm run dev
```

---

## Performance Tips

### 1. File Organization
Files are automatically organized by workspace/case. This helps with:
- Easy cleanup when deleting cases
- Efficient listing of case documents
- Clear audit trail

### 2. File Naming
Files include timestamps: `1730500000000-filename.pdf`
- Prevents naming collisions
- Easy to sort by upload time
- Supports multiple uploads of same file

### 3. Fallback Strategy
If Supabase upload fails, files automatically fallback to `/tmp`:
- Graceful degradation
- User can still upload
- Warns in logs with `[Storage]` tag
- Production: Investigate failed uploads in logs

### 4. URL Generation
Public URLs are auto-generated:
```typescript
// Automatic
https://your-project.supabase.co/storage/v1/object/public/case-documents/ws_abc/case_123/file.pdf

// Accessible in:
- Frontend (download links)
- Database (stored as document.url)
- Reports (embedded)
```

---

## Migration from Temporary Storage

**Current Status:** All new uploads go to Supabase Storage

**Existing Files:**
- Old temp files in `/tmp/justoai-uploads/` can be cleaned up
- Database records still point to old paths (fallback still works)
- Optional: Migrate historical files to Supabase (feature request)

---

## Next Steps

1. ✅ **Verify Buckets Created:** Visit Supabase Dashboard → Storage
2. ✅ **Test Upload:** Upload a PDF via web UI
3. ✅ **Check Files:** See them appear in Supabase Storage dashboard
4. ✅ **Review Logs:** Ensure no errors in `[Storage]` tag messages
5. 📋 **Monitor:** Track storage usage in Supabase dashboard

---

## FAQ

**Q: What happens if Supabase is down?**
A: Uploads fallback to temp storage (`/tmp`). File persists for that request but won't survive server restart. Logs will warn with `[Storage]` tag.

**Q: Can users download their files?**
A: Yes! Public URLs are generated for case-documents. Private buckets require authenticated requests.

**Q: How do I serve files securely?**
A: Use private buckets (case-attachments, reports) with Supabase RLS policies. Implement authenticated endpoints that check permissions before serving.

**Q: Can I migrate old files?**
A: Yes, but currently manual. Feature request in backlog.

**Q: Are there storage limits?**
A: Free plan: 1GB total. Pro plan: 100GB included. Scale from there.

**Q: How is billing calculated?**
A: By GB stored per month. See Supabase pricing dashboard for real-time usage.

---

## Support

For issues or questions:
1. Check **Supabase Status:** https://status.supabase.com/
2. Review **Supabase Docs:** https://supabase.com/docs/guides/storage
3. Check `TODO_TRACKER.md` for related items
4. File GitHub issue with `[Storage]` tag in logs

---

**Last Updated:** 2025-11-02
**Maintainer:** Development Team
