/**
 * ================================================================
 * UPLOAD ROUTER - Smart routing for large files
 * ================================================================
 *
 * Problem: Vercel Hobby has 4.5MB request limit
 * Solution: Route large files directly to Railway backend
 *
 * - Files < 4.5MB: Upload via Vercel (closer to user, can cache)
 * - Files >= 4.5MB: Upload directly to Railway (no Vercel limit)
 */

const VERCEL_LIMIT = 4.5 * 1024 * 1024; // 4.5MB
const RAILWAY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'justoai-vers-o2-production.up.railway.app';

/**
 * Determine upload endpoint based on file size
 * @param fileSize - Size in bytes
 * @param endpoint - 'documents' or 'process'
 * @returns URL to upload to
 */
export function getUploadEndpoint(fileSize: number, endpoint: 'documents' | 'process' = 'documents'): {
  url: string;
  isDirect: boolean;
  reason: string;
} {
  const isBig = fileSize >= VERCEL_LIMIT;

  if (isBig) {
    // Large files go directly to Railway (no Vercel limit)
    return {
      url: `https://${RAILWAY_API_URL}/api/${endpoint}/upload`,
      isDirect: true,
      reason: `File ${(fileSize / 1024 / 1024).toFixed(1)}MB exceeds Vercel limit (4.5MB), routing to Railway`,
    };
  } else {
    // Small files use Vercel proxy (faster, can be cached)
    return {
      url: `/api/${endpoint}/upload`,
      isDirect: false,
      reason: `File ${(fileSize / 1024 / 1024).toFixed(1)}MB within Vercel limit, using proxy`,
    };
  }
}

/**
 * Upload file with automatic routing
 * Handles both Vercel proxy and Railway direct upload
 */
export async function uploadFile(
  file: File,
  endpoint: 'documents' | 'process' = 'documents',
  onProgress?: (progress: number) => void
): Promise<Response> {
  const { url, isDirect, reason } = getUploadEndpoint(file.size, endpoint);

  console.log(`📤 [Upload Router] ${reason}`);
  console.log(`📤 [Upload Router] Uploading to: ${url}`);

  // Build FormData
  const formData = new FormData();
  formData.append('file', file);

  // Get auth token from localStorage (or however you store it)
  const token = localStorage.getItem('auth_token') || '';
  const cookie = document.cookie;

  const headers: Record<string, string> = {};
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers, // Auth headers
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Upload Router] Upload failed: ${errorMsg}`);
    throw error;
  }
}

/**
 * Check if using Railway directly or Vercel proxy
 */
export function isDirectUpload(fileSize: number): boolean {
  return fileSize >= VERCEL_LIMIT;
}

/**
 * Get human-readable size
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
