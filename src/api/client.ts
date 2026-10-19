/** Thin fetch wrapper: same-origin cookies, CSRF header on writes, typed errors. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const CSRF_HEADER = { 'x-vdi-request': '1' };

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string; details?: unknown } })?.error;
    throw new ApiError(res.status, err?.message ?? (typeof data === 'string' && data ? data : res.statusText), err?.code, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined | null | string[]>) => {
    const qs = params ? toQuery(params) : '';
    return fetch(`${path}${qs ? `?${qs}` : ''}`, { credentials: 'same-origin', headers: { accept: 'application/json' } }).then((r) => handle<T>(r));
  },
  send: <T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
    fetch(path, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json', ...CSRF_HEADER }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => handle<T>(r)),
  upload: <T>(path: string, form: FormData) => fetch(path, { method: 'POST', credentials: 'same-origin', headers: CSRF_HEADER, body: form }).then((r) => handle<T>(r)),
};

export function toQuery(params: Record<string, string | number | boolean | undefined | null | string[]>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','));
    } else q.set(k, String(v));
  }
  return q.toString();
}

/** Downloads a file from a GET endpoint or from a POST returning a binary body. */
export async function download(path: string, init?: { method?: 'POST'; body?: unknown }, fallbackName = 'download'): Promise<void> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    credentials: 'same-origin',
    headers: init?.method ? { 'content-type': 'application/json', ...CSRF_HEADER } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) await handle(res);
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
