/** Small deterministic PRNG so demo data is stable between reloads. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    /** Approximately normal noise with mean 0, sd 1. */
    gauss: () => {
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return s - 3;
    },
    /** Poisson-ish integer sample around `mean`. */
    count: (mean: number) => {
      if (mean <= 0) return 0;
      if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * (() => { let s = 0; for (let i = 0; i < 6; i++) s += next(); return s - 3; })()));
      const L = Math.exp(-mean);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > L);
      return k - 1;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
