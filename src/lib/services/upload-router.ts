/**
 * ================================================================
 * UPLOAD ROUTER - Direct Supabase Uploads (Scalable)
 * ================================================================
 *
 * OPTION 3 IMPLEMENTATION (Hybrid Approach):
 * 1. Browser gets signed URL from /api/storage/signed-url
 * 2. Browser uploads directly to Supabase Storage (unlimited size)
 * 3. Supabase webhook triggers Railway worker for processing
 * 4. Worker uses UploadOrchestrator to process and update DB
 *
 * Benefits:
 * - No size limits (Supabase supports unlimited file size)
 * - No Vercel compute cost for file transfer
 * - Scales to thousands of concurrent uploads
 * - Faster uploads (direct to S3, not through proxies)
 * - Webhook-driven async processing
 */

/**
 * Request signed URL from backend
 * This authenticates the user before giving them upload permission
 */
export async function getSignedUploadUrl(
  fileName: string,
  workspaceId: string,
  caseId: string,
  bucket: 'case-documents' | 'case-attachments' | 'reports' = 'case-documents'
): Promise<{
  signedUrl: string;
  filePath: string;
  bucket: string;
  caseId: string;
  expiresIn: number;
}> {
  console.log(`📤 [Upload Router] Requesting signed URL for: ${fileName}`);

  const response = await fetch('/api/storage/signed-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include auth cookies
    body: JSON.stringify({
      fileName,
      workspaceId,
      caseId,
      bucket,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [Upload Router] Signed URL request failed ${response.status}: ${errorText}`);
    throw new Error(`Failed to get signed URL: ${response.status}`);
  }

  return response.json();
}

/**
 * Upload file directly to Supabase Storage using signed URL
 * No size limits - browser handles streaming to S3
 *
 * Important: Send file directly as binary, not FormData
 * Supabase signed URLs expect the file content as the request body
 */
export async function uploadFileToSupabase(
  file: File,
  signedUrl: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  console.log(`📤 [Upload Router] Uploading ${(file.size / 1024 / 1024).toFixed(2)}MB to Supabase`);

  try {
    const xhr = new XMLHttpRequest();

    // Track progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      });
    }

    // Upload
    return new Promise((resolve, reject) => {
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`✅ [Upload Router] File uploaded to Supabase`);
          resolve();
        } else {
          console.error(`❌ [Upload Router] Upload failed: ${xhr.status}`);
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        console.error(`❌ [Upload Router] Network error during upload`);
        reject(new Error('Network error during upload'));
      });

      xhr.open('PUT', signedUrl);
      // Send file directly as binary body (not FormData)
      // Supabase expects the raw file content with PUT method
      // Don't set Content-Type - let browser handle it
      xhr.send(file);
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Upload Router] Upload error: ${errorMsg}`);
    throw error;
  }
}

/**
 * Main upload function - orchestrates the full flow
 */
export async function uploadFile(
  file: File,
  workspaceId: string,
  caseId: string,
  bucket: 'case-documents' | 'case-attachments' | 'reports' = 'case-documents',
  onProgress?: (progress: number) => void
): Promise<{
  filePath: string;
  caseId: string;
  bucket: string;
  uploadedAt: string;
  processing: boolean;
}> {
  console.log(`📤 [Upload Router] Starting upload: ${file.name}`);

  // Step 1: Get signed URL (authenticates user, creates placeholder case if needed)
  const { signedUrl, filePath, caseId: returnedCaseId } = await getSignedUploadUrl(
    file.name,
    workspaceId,
    caseId,
    bucket
  );

  // Step 2: Upload to Supabase (direct browser → S3)
  await uploadFileToSupabase(file, signedUrl, onProgress);

  console.log(`✅ [Upload Router] Upload complete: ${filePath}`);

  // Step 3: Trigger processing via callback
  console.log(`📤 [Upload Router] Triggering server-side processing`);

  let finalCaseId = returnedCaseId;

  try {
    const callbackResponse = await fetch('/api/process/upload-callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        filePath,
        bucket,
        workspaceId,
      }),
    });

    if (!callbackResponse.ok) {
      const errorText = await callbackResponse.text();
      console.warn(`⚠️ [Upload Router] Callback returned ${callbackResponse.status}: ${errorText.substring(0, 100)}`);
      // Don't throw - processing might still happen server-side
    } else {
      // Try to extract caseId from callback response
      try {
        const callbackData: unknown = await callbackResponse.json();
        if (typeof callbackData === 'object' && callbackData !== null && 'caseId' in callbackData) {
          const responseId = (callbackData as Record<string, unknown>).caseId;
          if (typeof responseId === 'string') {
            finalCaseId = responseId;
            console.log(`✅ [Upload Router] Processing triggered, case: ${finalCaseId}`);
          }
        }
      } catch {
        console.log(`✅ [Upload Router] Processing triggered successfully`);
      }
    }
  } catch (callbackError) {
    console.warn(`⚠️ [Upload Router] Callback error (processing will retry): ${callbackError}`);
    // Don't throw - the file is safely in Supabase
  }

  return {
    filePath,
    caseId: finalCaseId,
    bucket,
    uploadedAt: new Date().toISOString(),
    processing: true,
  };
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
