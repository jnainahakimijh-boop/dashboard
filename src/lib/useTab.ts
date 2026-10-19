import { useSearchParams } from 'react-router-dom';

/** Tab state in the URL (`?tab=`), so tabs are shareable and survive reloads. */
export function useTab<T extends string>(tabs: readonly T[], fallback: T): [T, (t: T) => void] {
  const [sp, setSp] = useSearchParams();
  const cur = sp.get('tab') as T | null;
  const tab = cur && tabs.includes(cur) ? cur : fallback;
  const set = (t: T) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('tab', t);
        return n;
      },
      { replace: true },
    );
  return [tab, set];
}
