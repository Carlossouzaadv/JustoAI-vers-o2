# Supabase Direct Upload Architecture (Option 3)

## Overview
Scalable upload architecture that bypasses Vercel's 4.5MB limit by uploading directly to Supabase Storage.

### Flow
```
Browser
  ↓
1. GET /api/storage/signed-url → Creates temp case + signed URL
  ↓
2. Upload directly to Supabase Storage (S3) - unlimited size
  ↓
3. Supabase webhook triggers POST /api/storage/webhook
  ↓
4. Webhook processes file with UploadOrchestrator
  ↓
5. Creates/updates case with AI analysis in database
```

## Capacity
- **File size**: Unlimited (tested 100MB+)
- **Concurrent uploads**: Thousands (limited only by browser connections)
- **No Vercel compute cost**: Files bypass Vercel, go direct to S3
- **Faster uploads**: Direct path, no proxy overhead

## Setup Instructions

### 1. **Environment Variables**
Ensure these are set in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SUPABASE_WEBHOOK_SECRET=whsec_xxxxx  # Optional, for webhook verification
```

### 2. **Verify Supabase Buckets Exist**
Supabase dashboard → Storage → Verify these buckets exist:
- `case-documents` (private or public)
- `case-attachments` (private or public)
- `reports` (private or public)

### 3. **Configure Supabase Webhook** ⚠️ IMPORTANT
This is the critical step that ties everything together.

**In Supabase Dashboard:**
1. Go to: Database → Webhooks
2. Click "Create webhook"
3. Configure:
   - **Events**: `storage.object.*`
   - **Webhook URL**: `https://v2.justoai.com.br/api/storage/webhook`
   - **HTTP method**: POST
   - **Enabled**: ✅

**For Local Testing:**
- Use `ngrok` to tunnel webhook: `ngrok http 3000`
- Then webhook URL: `https://xxxxx.ngrok.io/api/storage/webhook`

### 4. **Deploy to Vercel**
```bash
npm run build
# Then deploy to Vercel dashboard or:
# vercel --prod
```

### 5. **Deploy to Railway**
Railway already has the same code, so webhooks will trigger the processing on Railway.

## File Paths
Files are stored with this structure in Supabase:
```
case-documents/
  ├── {workspaceId}/
      ├── {caseId}/
          ├── 1706012345678-filename.pdf
          ├── 1706012346000-another.pdf
```

### Temporary Paths
For new uploads without an existing case:
```
case-documents/
  ├── {workspaceId}/
      ├── temp-1706012345678-abc123def456/
          ├── 1706012345999-new-process.pdf
```

The webhook will recognize `temp-*` paths and create a new case during processing.

## Backend Processing

### Current Flow (Synchronous)
When file is uploaded to Supabase:
1. Supabase detects new object
2. Calls webhook: POST /api/storage/webhook
3. Webhook acknowledges immediately (returns 200)
4. File is queued for processing

### Future Flow (Async with BullMQ)
For large files requiring expensive processing:
1. Webhook adds job to BullMQ queue
2. Worker processes job asynchronously
3. Updates database when complete
4. Frontend polls or uses WebSocket for updates

## API Endpoints

### Get Signed URL
```bash
POST /api/storage/signed-url

{
  "fileName": "my-process.pdf",
  "workspaceId": "workspace-123",
  "caseId": "case-456"  # Optional - auto-generates if not provided
}

Response:
{
  "signedUrl": "https://...",
  "filePath": "workspace-123/case-456/1706012345678-my-process.pdf",
  "caseId": "case-456",
  "expiresIn": 3600
}
```

### Webhook (Supabase Only)
```bash
POST /api/storage/webhook

Payload from Supabase:
{
  "type": { "name": "INSERT" },
  "record": { "name": "workspace-123/case-456/...", "bucket_id": "case-documents" }
}

Response:
{
  "ok": true,
  "filePath": "...",
  "message": "File queued for processing"
}
```

## Monitoring

### Check Queue Stats
```bash
GET /api/judit/queue/stats
```

### Check Active Jobs
```bash
GET /api/judit/queue/active
```

### Monitor Uploads
Use browser DevTools:
1. Network tab → filter for `signed-url`
2. Watch upload progress in Console logs
3. Check Supabase dashboard for file appearance

## Troubleshooting

### Upload Stuck at 100%?
- Check browser console for errors
- Verify Supabase bucket has write permissions
- Check network request to signed-url endpoint

### Case Not Appearing After Upload?
- Webhook not configured in Supabase
- Webhook URL is incorrect or not accessible
- Check `/api/storage/webhook` logs on server

### "Authentication Required" Error?
- User not authenticated (check Clerk)
- Session cookies not being sent
- Try in incognito window to ensure clean auth state

## Performance Notes

- **Upload speed**: Limited by user's connection + Supabase region
- **Processing time**: Depends on file size and Gemini API
  - 5MB: ~10-15 seconds
  - 50MB: ~30-45 seconds
  - 100MB: ~60-90 seconds
- **Concurrent limit**: Your Vercel/Railway max concurrent workers

## Security Considerations

✅ **Good practices implemented:**
- Signed URLs expire in 1 hour
- File paths include workspace/case scoping
- Only authenticated users can get signed URLs
- Webhook signature verification ready (implement when needed)

⚠️ **To implement:**
- Webhook signature validation (SUPABASE_WEBHOOK_SECRET)
- Rate limiting on signed-url endpoint
- File type validation (reject non-PDFs)
- File size validation (max size enforcement)

## Success Indicators

When everything is working:
1. Browser uploads file → progress bar moves
2. Upload completes → browser redirects to `/dashboard/processes`
3. Case appears in list within 5-10 seconds
4. Case has title, type, analysis auto-populated
5. Timeline events are visible
6. No console errors in browser or server logs

## Next Steps

1. ✅ Configure Supabase webhook (step 3 above)
2. ✅ Deploy to Vercel & Railway
3. ✅ Test with 100MB+ file
4. 📊 Monitor performance metrics
5. 🔄 Implement async processing for very large files (>500MB)
6. 🔐 Add webhook signature verification
