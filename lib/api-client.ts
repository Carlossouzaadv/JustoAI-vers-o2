/**
 * API Client Utility - Handles both local development and production
 *
 * In production (Vercel), client-side requests need the full URL.
 * In development, relative URLs work fine, but absolute URLs also work.
 */

/**
 * Get the base URL for API calls
 * Works in both browser and Node.js environments
 */
export function getApiBaseUrl(): string {
  // In browser
  if (typeof window !== 'undefined') {
    // Use the current origin (window.location.origin)
    return window.location.origin;
  }

  // In Node.js (server-side) - shouldn't normally be used for client-side calls
  // but included for completeness
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Build a full API URL from a path
 * @param path - API path (e.g., '/api/clients')
 * @returns Full URL with base URL and path
 */
export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Helper to build query strings
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

/**
 * Build a full API URL with query parameters
 */
export function getApiUrlWithParams(
  path: string,
  params?: Record<string, any>
): string {
  let url = getApiUrl(path);
  if (params && Object.keys(params).length > 0) {
    const queryString = buildQueryString(params);
    url += `?${queryString}`;
  }
  return url;
}

/**
 * Standard fetch options for API calls
 */
export const defaultFetchOptions: RequestInit = {
  credentials: 'include', // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Make an API call with proper URL handling
 */
export async function apiCall<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = getApiUrl(path);
  const response = await fetch(url, {
    ...defaultFetchOptions,
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
