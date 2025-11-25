/**
 * Supabase Storage Service
 * Handles permanent file storage for case documents, reports, and attachments
 *
 * Buckets:
 * - 'case-documents': Original PDFs and documents uploaded by users
 * - 'case-attachments': Files downloaded from JUDIT or other sources
 * - 'reports': Generated reports (PDF, DOCX, Excel)
 */

import { createClient } from '@supabase/supabase-js';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

// Lazy-loaded Supabase client (initialized only when needed, not at module import time)
// This prevents build failures in environments where env vars aren't available yet
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient(): ReturnType<typeof createClient> {
  // Return cached instance if already initialized
  if (supabaseClient) {
    return supabaseClient;
  }

  // Initialize client on first use
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      `${ICONS.ERROR} [Storage] Missing Supabase credentials\n` +
      `Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n` +
      `Storage operations will fail until environment variables are configured`
    );
    throw new Error('Missing Supabase environment variables - check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  log.info({ msg: "[Storage] Supabase client initialized" });
  return supabaseClient;
}

// Bucket names
export const STORAGE_BUCKETS = {
  CASE_DOCUMENTS: 'case-documents',
  CASE_ATTACHMENTS: 'case-attachments',
  REPORTS: 'reports'
};

// File upload response
export interface StorageUploadResult {
  success: boolean;
  url?: string; // Public URL
  storagePath?: string; // Path in storage (bucket/path/to/file)
  error?: string;
  bucketName?: string;
}

/**
 * Upload a file to Supabase Storage
 *
 * @param bucket - Bucket name from STORAGE_BUCKETS
 * @param filePath - Path in bucket (e.g., "workspace-id/case-id/filename")
 * @param fileBuffer - Buffer containing file data
 * @param mimeType - MIME type of file
 * @returns StorageUploadResult with URL or error
 */
export async function uploadToStorage(
  bucket: string,
  filePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<StorageUploadResult> {
  try {
    // Ensure bucket exists
    await ensureBucketExists(bucket);

    // Upload file
    const { data, error } = await getSupabaseClient().storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false // Fail if file already exists
      });

    if (error) {
      logError(error, "${ICONS.ERROR} Storage Upload failed:", { component: "refactored" });

      // If file exists, get its URL anyway
      if (error.message?.includes('duplicate')) {
        const publicUrl = getPublicUrl(bucket, filePath);
        return {
          success: true,
          url: publicUrl,
          storagePath: filePath,
          bucketName: bucket
        };
      }

      return {
        success: false,
        error: `Failed to upload file: ${error.message}`
      };
    }

    // Get public URL
    const publicUrl = getPublicUrl(bucket, filePath);

    log.info({ msg: "[Storage] File uploaded:" });

    return {
      success: true,
      url: publicUrl,
      storagePath: data.path,
      bucketName: bucket
    };
  } catch (_error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logError(errorMsg, "${ICONS.ERROR} Storage Upload error:", { component: "refactored" });
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Upload file and return the permanent URL
 * Convenience function for common case document uploads
 *
 * @param workspaceId - Workspace ID
 * @param caseId - Case ID
 * @param fileName - Original file name
 * @param fileBuffer - File content
 * @param mimeType - MIME type
 * @returns Public URL or null on error
 */
export async function uploadCaseDocument(
  workspaceId: string,
  caseId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string | null> {
  // Create organized path: workspace/case/timestamp-filename
  const timestamp = Date.now();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${workspaceId}/${caseId}/${timestamp}-${safeFileName}`;

  const result = await uploadToStorage(
    STORAGE_BUCKETS.CASE_DOCUMENTS,
    filePath,
    fileBuffer,
    mimeType
  );

  // Narrowing: Only return url if it exists and is a non-empty string
  if (result.success && typeof result.url === 'string' && result.url.length > 0) {
    return result.url;
  }
  return null;
}

/**
 * Upload report file (PDF, DOCX, Excel)
 */
export async function uploadReport(
  workspaceId: string,
  caseId: string,
  reportType: 'pdf' | 'docx' | 'excel',
  fileBuffer: Buffer,
  reportName?: string
): Promise<string | null> {
  const timestamp = Date.now();
  const fileName = reportName || `report-${timestamp}`;
  const filePath = `${workspaceId}/${caseId}/reports/${timestamp}-${fileName}.${reportType}`;

  const mimeTypes = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  const result = await uploadToStorage(
    STORAGE_BUCKETS.REPORTS,
    filePath,
    fileBuffer,
    mimeTypes[reportType]
  );

  // Narrowing: Only return url if it exists and is a non-empty string
  if (result.success && typeof result.url === 'string' && result.url.length > 0) {
    return result.url;
  }
  return null;
}

/**
 * Upload attachment from JUDIT or external source
 */
export async function uploadAttachment(
  workspaceId: string,
  caseId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const timestamp = Date.now();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${workspaceId}/${caseId}/attachments/${timestamp}-${safeFileName}`;

  const result = await uploadToStorage(
    STORAGE_BUCKETS.CASE_ATTACHMENTS,
    filePath,
    fileBuffer,
    mimeType
  );

  // Narrowing: Only return url if it exists and is a non-empty string
  if (result.success && typeof result.url === 'string' && result.url.length > 0) {
    return result.url;
  }
  return null;
}

/**
 * Get public URL for a file in storage
 */
export function getPublicUrl(bucket: string, filePath: string): string {
  const { data } = getSupabaseClient().storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Delete a file from storage
 */
export async function deleteFromStorage(
  bucket: string,
  filePath: string
): Promise<boolean> {
  try {
    const { error } = await getSupabaseClient().storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      logError(error, "${ICONS.ERROR} Storage Delete failed:", { component: "refactored" });
      return false;
    }

    log.info({ msg: "[Storage] File deleted:" });
    return true;
  } catch (_error) {
    logError(error, "${ICONS.ERROR} Storage Delete error:", { component: "refactored" });
    return false;
  }
}

/**
 * List files in a directory
 */
export async function listStorageFiles(
  bucket: string,
  folderPath: string
): Promise<Array<{ name: string; id: string; updated_at: string; metadata: Record<string, unknown> }>> {
  try {
    const { data, error } = await getSupabaseClient().storage
      .from(bucket)
      .list(folderPath);

    if (error) {
      logError(error, "${ICONS.ERROR} Storage List failed:", { component: "refactored" });
      return [];
    }

    return data || [];
  } catch (_error) {
    logError(error, "${ICONS.ERROR} Storage List error:", { component: "refactored" });
    return [];
  }
}

/**
 * Ensure bucket exists and create if needed
 * Buckets should be created via Supabase dashboard, but this helps with development
 */
async function ensureBucketExists(bucketName: string): Promise<boolean> {
  try {
    // Try to get bucket info
    const { data: buckets, error: listError } = await getSupabaseClient().storage.listBuckets();

    if (listError) {
      logError(listError, "${ICONS.WARNING} Storage Could not list buckets:", { component: "refactored" });
      return false;
    }

    const bucketExists = buckets?.some(b => b.name === bucketName);

    if (!bucketExists) {
      log.warn({ msg: "[Storage] Bucket '' does not exist" });
      log.warn({ msg: "Please create this bucket in Supabase dashboard: https://app.supabase.com" });
      return false;
    }

    return true;
  } catch (_error) {
    logError(error, "${ICONS.WARNING} Storage Bucket check error:", { component: "refactored" });
    return false;
  }
}

/**
 * Download file from storage to buffer (useful for processing)
 */
export async function downloadFromStorage(
  bucket: string,
  filePath: string
): Promise<Buffer | null> {
  try {
    const { data, error } = await getSupabaseClient().storage
      .from(bucket)
      .download(filePath);

    if (error) {
      logError(error, "${ICONS.ERROR} Storage Download failed:", { component: "refactored" });
      return null;
    }

    return Buffer.from(await data.arrayBuffer());
  } catch (_error) {
    logError(error, "${ICONS.ERROR} Storage Download error:", { component: "refactored" });
    return null;
  }
}

const supabaseStorageAPI = {
  uploadToStorage,
  uploadCaseDocument,
  uploadReport,
  uploadAttachment,
  deleteFromStorage,
  listStorageFiles,
  downloadFromStorage,
  getPublicUrl,
  STORAGE_BUCKETS
};

export default supabaseStorageAPI;
