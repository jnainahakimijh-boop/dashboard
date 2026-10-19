/** Authenticated session from /api/auth/me. Permissions are for display only — the API enforces them. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import type { Permission } from '@shared/rbac';
import { ApiError, api } from '@/api/client';
import type { Me } from '@/api/types';

interface SessionCtx {
  me: Me | null;
  loading: boolean;
  can: (p: Permission) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<Me>('/api/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
  const me = q.data ?? null;
  const value: SessionCtx = {
    me,
    loading: q.isLoading,
    can: (p) => !!me?.permissions.includes(p),
    refresh: async () => {
      await qc.invalidateQueries();
    },
    logout: async () => {
      try {
        await api.send('POST', '/api/auth/logout');
      } finally {
        qc.clear();
        qc.setQueryData(['me'], null);
      }
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession outside provider');
  return c;
}
