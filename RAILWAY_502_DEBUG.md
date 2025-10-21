# 🚂 Railway 502 "Application Failed to Respond" - Debug Guide

## 🔴 Current Status
- **Error**: HTTP 502 Bad Gateway
- **Message**: "Application failed to respond"
- **Duration**: ~31-32 seconds before timeout
- **Endpoint**: `POST /api/pdf/process`
- **Trigger**: PDF file extraction during onboarding (1.3 MB PDF)

---

## 🔍 What We Know

### Logs from Vercel
```
2025-10-21T12:37:22.224Z [error] ❌ PDF extraction failed: HTTP 502
{
  "status": 502,
  "statusText": "Bad Gateway",
  "body": "{\"status\":\"error\",\"code\":502,\"message\":\"Application failed to respond\",\"request_id\":\"TPuZKgHJRmy9uRXhBT7zVQ\"}",
  "url": "https://justoai-vers-o2-production.up.railway.app/api/pdf/process",
  "duration_ms": 31773
}
```

### Analysis
1. **Request was sent** - Vercel successfully sent the PDF to Railway
2. **Railway received it** - Responded with 502 (not connection refused)
3. **Process took 31s** - Very close to Railway's timeout window
4. **"Failed to respond"** - Generic Railway error indicating:
   - Process crash
   - Unhandled exception
   - Timeout on backend
   - Out of memory
   - Service unavailable

---

## 🎯 Root Cause Possibilities

### 1. ❌ pdftotext Not Installed (UNLIKELY)
- **Status**: ✅ Confirmed installed in Dockerfile.api
- **Evidence**: `RUN apk add --no-cache libc6-compat openssl poppler-utils`

### 2. ⚠️ pdftotext Hanging or Crashing (LIKELY)
- **Symptoms**: 31s timeout matches pdftotext taking too long
- **Causes**:
  - PDF file is corrupted
  - PDF has unusual encoding
  - File system permissions issue
  - Out of memory during processing
  - Very large embedded images in PDF

### 3. ⚠️ Process Killed by Railway (LIKELY)
- **Railway Limits**:
  - Memory: Check if container is hitting limits
  - CPU: Check if process is consuming too much CPU
  - Timeout: Railway might have internal timeout

### 4. ⚠️ Next.js Standalone Issue (POSSIBLE)
- **Symptom**: Route not found or handler not exported
- **Check**: Is `/api/pdf/process` being served correctly?

### 5. ⚠️ Unhandled Error in Handler (POSSIBLE)
- **Symptom**: Silent crash
- **Previous Fix**: Added comprehensive logging

---

## 🧪 How to Debug

### Step 1: Check Railway Logs
**Best way**: SSH into Railway container and test directly

```bash
# Via Railway Dashboard:
# Project → justoai-v2-api → Deployments → Click latest → Logs

# Look for:
# - Any error messages from extractTextFromPDF()
# - pdftotext execution logs
# - Memory warnings
# - Timeout messages
```

### Step 2: Test pdftotext Directly in Railway
```bash
# SSH into Railway container
railway connect

# Test if pdftotext is available
which pdftotext

# Test extraction with a simple command
echo "test" | pdftotext /dev/stdin -
```

### Step 3: Test POST Endpoint Locally
```bash
# If you have SSH access to Railway:
curl -v http://localhost:3000/api/health

# Should return 200 OK
```

### Step 4: Test with Smaller PDF
- Try with a PDF < 100 KB
- If small PDFs work, issue is likely:
  - Memory limit
  - PDF complexity
  - Timeout

### Step 5: Check Railway Resource Usage
**During PDF processing test:**
- Open Railway Dashboard
- Watch CPU, Memory, Disk usage
- Look for spikes or limits being hit

---

## 🛠️ Temporary Workarounds

### Workaround 1: Increase PDF Processing Timeout
**Current**: 15 seconds for pdftotext
**Try**: 30 seconds

```typescript
const result = executeWithTimeout('pdftotext', [pdfPath, '-'], 30000); // 30s
```

**Risk**: Might hit Railway's overall timeout

---

### Workaround 2: Skip PDF Extraction if It Fails
**Current**: Crash with 500 error
**Better**: Return empty text and continue

```typescript
try {
  const result = executeWithTimeout('pdftotext', [pdfPath, '-'], 15000);
  text = result.stdout || '';
} catch (error) {
  // Graceful degradation
  console.warn('PDF extraction failed, continuing with empty text');
  text = '';
}
```

**Trade-off**: Lose text extraction but process continues

---

### Workaround 3: Add Fallback to Python pdfplumber
**Instead of**: pdftotext (C-based, sometimes crashes)
**Use**: pdfplumber (Python, more stable)

```dockerfile
# In Dockerfile.api
RUN apk add --no-cache python3 py3-pip && \
    pip install pdfplumber
```

```typescript
// Try Python fallback if pdftotext fails
const result = executeWithTimeout('python3', [
  '-c',
  `import pdfplumber; pdf=pdfplumber.open('${pdfPath}'); print(''.join([t for p in pdf.pages if (t:=p.extract_text())]))`,
], 20000);
```

---

## 📋 Immediate Actions to Take

### 1. Re-Deploy with Enhanced Logging
✅ **Already done** - Commit `4465871`

```typescript
// executeWithTimeout() now logs:
- Command execution start
- Duration tracking
- Error details with exit codes
- Signal termination info
```

### 2. Run Test Again and Capture Logs
```bash
# Test onboarding again with a PDF
# Capture full Railway logs output
```

### 3. Check Railway Container Stats
- Memory usage
- CPU usage
- Disk I/O

---

## 🔧 If Problem Persists After Re-Deploy

### Option A: Reduce PDF Size
**Requirement**: Limit maximum PDF upload size
```env
NEXT_PUBLIC_UPLOAD_MAX_SIZE=5242880  # 5MB instead of 10MB
```

---

### Option B: Move PDF Extraction to Separate Worker
**Architecture**:
- Vercel: Just save PDF to temp storage
- Worker service: Process PDF asynchronously
- Callback: Update case when done

**Benefits**:
- No timeout constraints
- Better resource isolation
- Can retry on failure

---

### Option C: Use Cloud PDF Service
**Options**:
- `extract.dev` API
- `pdfshift.io`
- `pdfrw` cloud service
- AWS Textract

**Pros**: No local pdftotext needed
**Cons**: Additional API costs

---

## 📊 Performance Baseline

**Expected times** for PDF extraction:
- 1 MB PDF with text: 1-3 seconds
- 1 MB PDF with images: 5-10 seconds
- Large PDF (10 MB): 10-30 seconds

**Actual**:
- Our PDF: ~31 seconds (timeout)

**Conclusion**: pdftotext is either:
1. Hanging on this specific PDF
2. Out of resources
3. Not receiving signals properly

---

## 🚀 Next Steps

### Immediate (Today)
1. ✅ Deploy with enhanced logging
2. 📝 Test extraction again
3. 📊 Check Railway logs for new error details

### Short-term (Next 24h)
1. If logs show pdftotext error → Fix specific issue
2. If logs show timeout → Increase limits or use fallback
3. If logs show memory → Reduce concurrency or PDF size

### Long-term (This Week)
1. Implement async PDF processing in worker
2. Add PDF size validation
3. Consider cloud PDF service for large files
4. Add metrics/monitoring for extraction performance

---

## 📞 Support Resources

### Railway Debugging
- https://docs.railway.app/troubleshoot/debugging
- https://docs.railway.app/troubleshoot/common-issues

### pdftotext
- https://poppler.freedesktop.org/
- Common issues: https://github.com/Automattic/node-poppler/issues

### Next.js Serverless
- https://nextjs.org/docs/deployment/vercel

---

## 📝 Log Output to Expect (After Fix)

```
[HH:MM:SS] ✅ [POST /api/pdf/process] Iniciado
[HH:MM:SS] ✅ [extractTextFromPDF] Iniciando extração com pdftotext
[HH:MM:SS] ⏱️ [executeWithTimeout] Iniciando: pdftotext (timeout: 15000ms)
[HH:MM:SS] ✅ [executeWithTimeout] Completo em 2345ms (status: 0)
[HH:MM:SS] ✅ [extractTextFromPDF] Sucesso! 15234 caracteres em 2410ms
[HH:MM:SS] ✅ PDF processed successfully
```

---

**Last Updated**: 2025-10-21 13:45 UTC
**Status**: Investigating - Enhanced logging deployed
