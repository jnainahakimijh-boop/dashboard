import { useSearchParams } from 'react-router-dom';

/** A single query-string value (used by deep links from global search) with a way to clear it. */
export function useUrlParam(name: string): [string | null, () => void] {
  const [sp, setSp] = useSearchParams();
  const clear = () =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete(name);
        return n;
      },
      { replace: true },
    );
  return [sp.get(name), clear];
}
