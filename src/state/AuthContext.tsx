import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Demo authentication for the prototype. Accepts admin / admin and stores a
 *  flag locally — a production deployment would authenticate via SSO. */

const AUTH_KEY = 'dp.auth';

interface AuthCtx {
  authed: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTH_KEY) === '1';
    } catch {
      return false;
    }
  });

  const login = useCallback((user: string, pass: string) => {
    const ok = user.trim().toLowerCase() === 'admin' && pass === 'admin';
    if (ok) {
      setAuthed(true);
      try {
        localStorage.setItem(AUTH_KEY, '1');
      } catch {
        /* storage unavailable — session-only auth */
      }
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    setAuthed(false);
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ authed, login, logout }), [authed, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
