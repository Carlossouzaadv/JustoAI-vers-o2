'use client';

import { createContext, useContext, useEffect, useState } from 'react';

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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  workspaceId: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithWorkspaces | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const response = await fetch('/api/users/current', {
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);

          // Set first workspace as default
          if (userData.workspaces && userData.workspaces.length > 0) {
            setWorkspaceId(userData.workspaces[0].workspaceId);
            console.log('✅ AuthContext loaded:', {
              user: userData.email,
              workspace: userData.workspaces[0].workspace.name
            });
          } else {
            console.warn('⚠️ User has no workspaces');
          }
        } else if (response.status === 401) {
          // Not authenticated
          setUser(null);
          setWorkspaceId(null);
        } else {
          setError('Failed to load user data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication error');
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, workspaceId, loading, error }}>
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
