/** Counter-based deterministic randomness: every value is a pure function of
 *  integer coordinates, so generation order never changes the dataset. */

function mix(h: number, k: number): number {
  k = Math.imul(k, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform [0,1) from up to six integer coordinates. */
export function u01(a: number, b = 0, c = 0, d = 0, e = 0, f = 0): number {
  let h = 0x9747b28c;
  h = mix(h, a);
  h = mix(h, b);
  h = mix(h, c);
  h = mix(h, d);
  h = mix(h, e);
  h = mix(h, f);
  return fmix(h) / 4294967296;
}

/** Approximately standard normal (Irwin–Hall with 4 terms, variance-corrected). */
export function gauss(a: number, b = 0, c = 0, d = 0, e = 0): number {
  const s = u01(a, b, c, d, e, 1) + u01(a, b, c, d, e, 2) + u01(a, b, c, d, e, 3) + u01(a, b, c, d, e, 4);
  return (s - 2) * Math.sqrt(3);
}

/** Multiplicative noise centred on 1, floored at 0.05. */
export function noise(sd: number, a: number, b = 0, c = 0, d = 0, e = 0): number {
  return Math.max(0.05, 1 + sd * gauss(a, b, c, d, e));
}

/** Stable 32-bit hash of a string, for salting coordinates. */
export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Unbiased stochastic rounding of a non-negative expectation. */
export function sround(x: number, a: number, b = 0, c = 0, d = 0, e = 0): number {
  if (!(x > 0)) return 0;
  const f = Math.floor(x);
  return f + (u01(a, b, c, d, e, 7) < x - f ? 1 : 0);
}

/** Largest-remainder integer allocation of `total` by `weights` (sums exactly to total). */
export function allocate(total: number, weights: ArrayLike<number>): Int32Array {
  const n = weights.length;
  const out = new Int32Array(n);
  if (total <= 0 || n === 0) return out;
  let wsum = 0;
  for (let i = 0; i < n; i++) wsum += Math.max(0, weights[i]);
  if (wsum <= 0) return out;
  const rem = new Float64Array(n);
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    const exact = (total * Math.max(0, weights[i])) / wsum;
    out[i] = Math.floor(exact);
    rem[i] = exact - out[i];
    assigned += out[i];
  }
  let left = total - assigned;
  while (left > 0) {
    let best = 0;
    for (let i = 1; i < n; i++) if (rem[i] > rem[best]) best = i;
    out[best] += 1;
    rem[best] = -1;
    left -= 1;
  }
  return out;
}
