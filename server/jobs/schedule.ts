/** Frequency definitions evaluated in the organisation time zone (default Europe/Paris). */
import { z } from 'zod';

export const frequencySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interval'), minutes: z.number().int().min(5).max(10080) }),
  z.object({ kind: z.literal('daily'), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  z.object({ kind: z.literal('weekly'), weekday: z.number().int().min(0).max(6), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  z.object({ kind: z.literal('monthly'), day: z.number().int().min(1).max(28), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
]);
export type Frequency = z.infer<typeof frequencySchema>;

/** Offset (ms) of `tz` from UTC at instant `t`. */
export function tzOffsetMs(tz: string, t: number): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** UTC instant of a wall-clock time in `tz` (DST-safe for non-ambiguous times). */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(tz, guess);
  const o2 = tzOffsetMs(tz, t);
  t = guess - o2;
  return new Date(t);
}

function zonedParts(t: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd };
}

/** Next run strictly after `after`. */
export function nextRun(freq: Frequency, after: Date, tz = 'Europe/Paris'): Date {
  if (freq.kind === 'interval') return new Date(after.getTime() + freq.minutes * 60_000);
  const [hh, mm] = freq.time.split(':').map(Number);
  for (let i = 0; i < 400; i++) {
    const probe = after.getTime() + i * 86_400_000;
    const { y, m, d, wd } = zonedParts(probe, tz);
    if (freq.kind === 'weekly' && wd !== freq.weekday) continue;
    if (freq.kind === 'monthly' && d !== freq.day) continue;
    const at = zonedToUtc(y, m, d, hh, mm, tz);
    if (at.getTime() > after.getTime()) return at;
  }
  throw new Error('Could not compute next run');
}

export function describeFrequency(freq: Frequency, lang: 'en' | 'fr' = 'en'): string {
  const days = lang === 'fr' ? ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  switch (freq.kind) {
    case 'interval':
      return lang === 'fr' ? `Toutes les ${freq.minutes} min` : `Every ${freq.minutes} min`;
    case 'daily':
      return lang === 'fr' ? `Chaque jour à ${freq.time}` : `Daily at ${freq.time}`;
    case 'weekly':
      return lang === 'fr' ? `Chaque ${days[freq.weekday]} à ${freq.time}` : `Every ${days[freq.weekday]} at ${freq.time}`;
    case 'monthly':
      return lang === 'fr' ? `Le ${freq.day} de chaque mois à ${freq.time}` : `Monthly on day ${freq.day} at ${freq.time}`;
  }
}
