
/**
 * Pure Auth Helper Functions
 * These functions have NO dependencies on React hooks or contexts
 * Safe to call from unknown environment (browser, server, API routes)
 */

/**
 * Get token from localStorage (browser-safe)
 * Returns null if not in browser environment
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('auth_token') || null;
  } catch (error) {
    console.error('Failed to read token from localStorage:', error);
    return null;
  }
}

/**
 * Set token in localStorage
 */
export function setStoredToken(token: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem('auth_token', token);
    return true;
  } catch (error) {
    console.error('Failed to save token to localStorage:', error);
    return false;
  }
}

/**
 * Clear token from localStorage
 */
export function clearStoredToken(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('workspace_id');
    return true;
  } catch (error) {
    console.error('Failed to clear token from localStorage:', error);
    return false;
  }
}

/**
 * Get user data from localStorage
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Failed to read user data from localStorage:', error);
    return null;
  }
}

/**
 * Set user data in localStorage
 */
export function setStoredUser(user: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem('user_data', JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('Failed to save user data to localStorage:', error);
    return false;
  }
}

/**
 * Get workspace ID from localStorage
 */
export function getStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('workspace_id') || null;
  } catch (error) {
    console.error('Failed to read workspace ID from localStorage:', error);
    return null;
  }
}

/**
 * Set workspace ID in localStorage
 */
export function setStoredWorkspaceId(workspaceId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem('workspace_id', workspaceId);
    return true;
  } catch (error) {
    console.error('Failed to save workspace ID to localStorage:', error);
    return false;
  }
}

/**
 * Clear all auth-related data from localStorage
 */
export function clearAllAuthData(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const keys = ['auth_token', 'user_data', 'workspace_id'];
    keys.forEach(key => localStorage.removeItem(key));
    return true;
  } catch (error) {
    console.error('Failed to clear auth data:', error);
    return false;
  }
}

/**
 * Check if user is authenticated (has token)
 */
export function isAuthenticated(): boolean {
  return Boolean(getStoredToken());
}

/**
 * Add authorization header with token
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}
