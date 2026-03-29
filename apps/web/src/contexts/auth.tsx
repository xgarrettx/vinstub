'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, type Plan } from '@/lib/api';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  plan: Plan | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (token: string, userId: string, plan: Plan) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setSession = useCallback((token: string, uid: string, p: Plan) => {
    api.setToken(token);
    setAccessToken(token);
    setUserId(uid);
    setPlan(p);
  }, []);

  const clearSession = useCallback(() => {
    api.clearToken();
    setAccessToken(null);
    setUserId(null);
    setPlan(null);
  }, []);

  // On mount: try to refresh from httpOnly cookie
  useEffect(() => {
    api
      .refresh()
      .then((res) => {
        // We don't get userId/plan back from refresh — decode JWT payload
        const payload = parseJwtPayload(res.accessToken);
        api.setToken(res.accessToken);
        setAccessToken(res.accessToken);
        setUserId((payload?.sub as string) ?? null);
        setPlan((payload?.plan as Plan) ?? null);
      })
      .catch(() => {
        // No valid refresh token — user is not logged in
        clearSession();
      })
      .finally(() => setIsLoading(false));
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      setSession(res.accessToken, res.userId, res.plan);
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    clearSession();
    router.push('/login');
  }, [clearSession, router]);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        userId,
        plan,
        isLoading,
        isAuthenticated: !!accessToken,
        login,
        logout,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
