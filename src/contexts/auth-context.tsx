'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getApiUrl } from '@/lib/api-client';
import { getStoredUser, setStoredUser, getStoredWorkspaceId, setStoredWorkspaceId, clearAllAuthData } from '@/lib/utils/auth-helpers';

interface UserWithWorkspaces {
  id: string;
  email: string;
  name: string;
  supabaseId: string;
  workspaces: Array<{
    workspaceId: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  createdAt: string;
}

interface AuthContextType {
  user: UserWithWorkspaces | null;
  workspaceId: string | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage FIRST (sync)
  const [user, setUser] = useState<UserWithWorkspaces | null>(() => {
    if (typeof window === 'undefined') return null;
    return getStoredUser();
  });

  const [workspaceId, setWorkspaceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return getStoredWorkspaceId();
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load user from API only once, on mount
  useEffect(() => {
    async function loadUser() {
      try {
        // Mark that we've started the initialization
        setHasInitialized(true);

        const response = await fetch(getApiUrl('/api/users/current'), {
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setStoredUser(userData);

          // Set first workspace as default
          if (userData.workspaces && userData.workspaces.length > 0) {
            const firstWorkspaceId = userData.workspaces[0].workspaceId;
            setWorkspaceId(firstWorkspaceId);
            setStoredWorkspaceId(firstWorkspaceId);

            console.log('✅ AuthContext loaded:', {
              user: userData.email,
              workspace: userData.workspaces[0].workspace.name
            });
          } else {
            console.warn('⚠️ User has no workspaces');
            setWorkspaceId(null);
            setStoredWorkspaceId('');
          }
        } else if (response.status === 401) {
          // Not authenticated - clear everything
          setUser(null);
          setWorkspaceId(null);
          clearAllAuthData();
          console.log('ℹ️ User not authenticated (401)');
        } else {
          setError('Failed to load user data');
          console.error('Error loading user - status:', response.status);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication error';
        setError(errorMessage);
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []); // Run only once on mount

  const logout = () => {
    setUser(null);
    setWorkspaceId(null);
    setError(null);
    clearAllAuthData();
    console.log('✅ User logged out');
  };

  const value: AuthContextType = {
    user,
    workspaceId,
    loading,
    error,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
