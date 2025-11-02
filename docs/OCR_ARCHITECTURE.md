# PDF OCR Architecture

## Overview

JustoAI V2 implements a distributed OCR strategy where:
- **Vercel (Frontend)** handles simple PDF parsing
- **Railway (Backend)** handles complex OCR processing
- HTTP communication between them

---

## Architecture Diagram

```
┌──────────────────────────────────────────┐
│     Vercel Frontend (Next.js)            │
│  - pdf-processor.ts (HTTP client)        │
│  - Dependencies: pdf-parse, pdfjs-dist   │
└────────┬─────────────────────────────────┘
         │
         │ HTTP POST /api/pdf/process
         │ (with PDF file + forceOCR flag)
         │
┌────────▼─────────────────────────────────┐
│    Railway Backend (Node.js Server)      │
│  - pdf-extractor.js (HTTP server)        │
│  - Dependencies: canvas, tesseract.js    │
└──────────────────────────────────────────┘
```

---

## Extraction Cascade Strategy

```
PDF File
  │
  ├─ Estratégia 1: pdf-parse
  │  └─ Timeout: 5 segundos
  │  └─ Success if text >= 100 chars
  │
  ├─ Estratégia 2: pdfjs-dist
  │  └─ Timeout: 10 segundos
  │  └─ Success if text >= 100 chars
  │
  └─ Estratégia 3: OCR (Tesseract.js)
     └─ Timeout: 120 segundos
     └─ Renderiza PDF → Canvas → OCR
     └─ Suporta português
     └─ Processa até 50 páginas
```

---

## Component Details

### Vercel: `src/lib/pdf-processor.ts`

**Role:** HTTP client that calls Railway for text extraction

**Methods:**
- `extractText(buffer, fileName)` - Main extraction method with cascade
- `extractWithPrimary(buffer, fileName)` - Calls pdf-parse via Railway
- `extractWithFallback(buffer)` - Returns empty (placeholder)
- `extractWithOCR(buffer, fileName)` - Calls Railway with `forceOCR=true`

**Key Features:**
- Passes PDF as FormData
- Sets appropriate timeouts per strategy
- Handles HTTP errors gracefully
- Returns extraction result with method used

**Example:**
```typescript
const { text, method, quality } = await pdfProcessor.extractText(pdfBuffer, 'document.pdf');
// method: 'primary' | 'fallback' | 'ocr'
// quality: 'high' | 'medium' | 'low'
```

### Railway: `src/lib/pdf-extractor.js`

**Role:** Backend server that performs actual text extraction and OCR

**Functions:**
- `extractTextFromPDF(pdfPath, forceOCR)` - Main extraction with cascade
  - If `forceOCR=true`: Skip pdf-parse/pdfjs-dist, go straight to OCR
  - Otherwise: Try pdf-parse → pdfjs-dist → OCR

- `extractTextWithOCR(pdfPath)` - Tesseract.js OCR implementation
  - Renders PDF pages to Canvas
  - 2x zoom for better accuracy
  - Portuguese language support
  - Max 50 pages

- `cleanText(text)` - Normalizes extracted text
- `extractProcessNumber(text)` - CNJ process number extraction
- `handlePdfProcessing(req)` - HTTP handler

**Key Features:**
- Uses Node.js native `require()` (not webpack-bundled)
- Canvas rendering for OCR
- Tesseract.js for optical character recognition
- Process number extraction
- Structured logging

---

## Dependencies

### Vercel (No Native Compilation)
```json
{
  "pdf-parse": "^2.4.3",      // Pure JavaScript
  "pdfjs-dist": "^5.4.296"    // Pure JavaScript
}
```

### Railway (Native Compilation OK)
Railway environment has build tools, so these are safe:
- `canvas` ^2.11.2 - PDF to Canvas rendering
- `tesseract.js` ^5.1.1 - OCR processing

**Note:** These are NOT in `package.json` to avoid Vercel build failures.
If deploying OCR to Railway, install separately:
```bash
npm install canvas@^2.11.2 tesseract.js@^5.1.1
```

---

## HTTP Communication

### Request: Vercel → Railway

```typescript
const formData = new FormData();
formData.append('file', blob, 'document.pdf');
formData.append('forceOCR', 'true'); // Optional: force OCR

const response = await fetch(`${RAILWAY_URL}/api/pdf/process`, {
  method: 'POST',
  body: formData,
  signal: AbortSignal.timeout(120000) // 120s timeout
});
```

### Response: Railway → Vercel

```json
{
  "success": true,
  "data": {
    "originalText": "Full extracted text...",
    "cleanedText": "Normalized text...",
    "processNumber": "1234567-89.0123.4.56.7890",
    "metrics": {
      "originalLength": 5000,
      "cleanedLength": 4800,
      "processingTimeMs": 2500,
      "method": "ocr"
    }
  }
}
```

---

## Error Handling

### Cascade Fallback
1. pdf-parse fails → Try pdfjs-dist
2. pdfjs-dist fails → Try OCR
3. OCR fails → Return empty text with error

### Graceful Degradation
- Missing text < 100 chars → Treated as failure
- Timeout errors → Continue to next strategy
- Network errors → Log and fallback

### Logging Tags
- `🚂 📄` Railway PDF processing
- `🔍` OCR operations
- `❌` Extraction failures

---

## Performance

| Method | Timeout | Speed | Success Rate |
|--------|---------|-------|--------------|
| pdf-parse | 5s | Fast | ~90% (text PDFs) |
| pdfjs-dist | 10s | Medium | ~70% (fallback) |
| OCR | 120s | Slow | ~95% (all PDFs) |

**Typical Processing:**
- Text PDF: 5-10s (pdf-parse or pdfjs-dist)
- Scanned PDF (50 pages): 60-120s (OCR)

---

## Configuration

### Environment Variables

**Vercel:**
```bash
PDF_PROCESSOR_URL=https://your-railway-backend.com
DEBUG=false  # Set to true for verbose logging
```

**Railway:**
```bash
NODE_ENV=production
PORT=3000
```

### Deployment Notes

1. **Vercel:** No native deps needed
2. **Railway:** Must have `canvas` and `tesseract.js` installed
3. **Build:** `.vercelignore` excludes `pdf-extractor.js` from Vercel

---

## Testing

### Test with Text PDF
```bash
curl -X POST http://localhost:3000/api/pdf/process \
  -F "file=@document.pdf" \
  -F "forceOCR=false"

# Expected: fast response, high quality text
```

### Test with Scanned PDF
```bash
curl -X POST http://localhost:3000/api/pdf/process \
  -F "file=@scanned.pdf" \
  -F "forceOCR=true"

# Expected: slower response (120s), but OCR extracted text
```

### Test from Vercel Client
```typescript
import { PDFProcessor } from '@/lib/pdf-processor';

const processor = new PDFProcessor();
const result = await processor.extractText(pdfBuffer, 'test.pdf');

console.log('Method:', result.method);        // 'primary' | 'ocr'
console.log('Quality:', result.quality);      // 'high' | 'medium' | 'low'
console.log('Text Length:', result.text.length);
```

---

## Troubleshooting

### "PDF not found" Error
- Ensure Railway PDF processor is running
- Check `PDF_PROCESSOR_URL` environment variable
- Verify network connectivity between Vercel and Railway

### OCR Timeout (>120s)
- PDF too large (>50 pages)
- Railway under heavy load
- Consider splitting large PDFs

### Missing Text in OCR
- PDF quality issues
- Language not Portuguese (hardcoded)
- Consider preprocessing with image enhancement

### Memory Issues on Railway
- Large PDFs consume memory
- Monitor Railway memory usage
- Consider chunking very large documents

---

## Future Improvements

1. **Language Detection** - Auto-detect PDF language instead of hardcoded Portuguese
2. **Parallel Processing** - Process PDF pages in parallel
3. **Image Preprocessing** - Enhance scanned image quality before OCR
4. **Caching** - Cache extracted text to avoid reprocessing
5. **Metrics Dashboard** - Track extraction success rates
6. **Fallback Strategy** - Email link if OCR takes too long

---

## References

- [pdf-parse Documentation](https://github.com/modesty/pdf-parse)
- [pdf.js Documentation](https://mozilla.github.io/pdf.js/)
- [Tesseract.js Documentation](https://github.com/naptha/tesseract.js)
- [Canvas.js Documentation](https://github.com/Automattic/node-canvas)

---

**Last Updated:** November 2, 2025
**Status:** Production Ready
