/** Deterministic seeded PRNG utilities.
 *  Every stream is derived from a string key, so the dataset is identical
 *  on every load and independent of generation order. */

function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;

  constructor(key: string) {
    this.next = mulberry32(hashString(key));
  }

  /** uniform [0,1) */
  f(): number {
    return this.next();
  }

  /** uniform in [min,max) */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** integer in [min,max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** approximately normal via sum of uniforms, mean 0, sd ~1 */
  normal(): number {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.next();
    return (s - 3) / Math.sqrt(0.5);
  }

  /** multiplicative noise centred at 1 with given relative sd */
  noise(sd: number): number {
    return Math.max(0.05, 1 + this.normal() * sd);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/** Deterministic value stream per (key, day) without sequential coupling. */
export function dayNoise(key: string, d: number, sd: number): number {
  return new Rng(`${key}:${d}`).noise(sd);
}

export function dayRng(key: string, d: number): Rng {
  return new Rng(`${key}:${d}`);
}
