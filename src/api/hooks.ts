import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { AnalyticsQuery, AnalyticsResponse } from '@shared/filters';
import { api } from './client';
import type { Meta } from './types';

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/api/meta'), staleTime: 5 * 60_000 });
}

/** Semantic-layer query; cache key is the full spec. */
export function useAnalytics(spec: AnalyticsQuery | null, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['analytics', spec],
    queryFn: () => api.send<AnalyticsResponse>('POST', '/api/analytics/query', spec),
    enabled: !!spec && (opts.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useApi<T>(path: string | null, params?: Record<string, string | number | boolean | undefined | null | string[]>, options?: Partial<UseQueryOptions<T>>) {
  return useQuery<T>({
    queryKey: [path, params],
    queryFn: () => api.get<T>(path!, params),
    enabled: !!path,
    placeholderData: keepPreviousData as never,
    staleTime: 30_000,
    ...options,
  });
}

/** Mutation that invalidates the given query-key prefixes on success. */
export function useApiMutation<TBody = unknown, TRes = unknown>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string | ((b: TBody) => string), invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation<TRes, Error, TBody>({
    mutationFn: (b: TBody) => api.send<TRes>(method, typeof path === 'function' ? path(b) : path, method === 'DELETE' ? undefined : b),
    onSuccess: async () => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(k) })));
    },
  });
}
