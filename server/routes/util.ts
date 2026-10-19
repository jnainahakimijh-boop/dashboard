import type { z, ZodTypeAny } from 'zod';
import { HttpError, type Ctx } from '../context';

export async function body<S extends ZodTypeAny>(c: Ctx, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON', 'invalid_json');
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(422, 'Validation failed', 'validation', r.error.flatten());
  return r.data;
}

export function query<S extends ZodTypeAny>(c: Ctx, schema: S): z.output<S> {
  const r = schema.safeParse(c.req.query());
  if (!r.success) throw new HttpError(422, 'Invalid query parameters', 'validation', r.error.flatten());
  return r.data;
}

export function param(c: Ctx, name: string): string {
  const v = c.req.param(name);
  if (!v) throw new HttpError(400, `Missing parameter ${name}`);
  return v;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(c: Ctx, name = 'id'): string {
  const v = param(c, name);
  if (!UUID.test(v)) throw new HttpError(404, 'Not found');
  return v;
}

export function notFound(what = 'Resource'): never {
  throw new HttpError(404, `${what} not found`, 'not_found');
}

/** Parse the shared analytics filter/date query string used by module endpoints. */
export function parseList(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  const parts = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  return parts.length ? parts : undefined;
}

import { comparisonRange, isIsoDate, type CompareMode, type DateRange } from '@shared/calendar';
import { FILTER_KEYS, normaliseFilters, type Filters } from '@shared/filters';

export interface PeriodParams {
  range: DateRange;
  compare: CompareMode;
  compareRange: DateRange | null;
  filters: Filters;
}

/** Common `from`, `to`, `compare` and filter parameters (comma-separated lists) for module endpoints. */
export function periodParams(c: Ctx, fallback: { from: string; to: string }): PeriodParams {
  const qp = c.req.query();
  const from = qp.from && isIsoDate(qp.from) ? qp.from : fallback.from;
  const to = qp.to && isIsoDate(qp.to) ? qp.to : fallback.to;
  if (from > to) throw new HttpError(422, '`from` must be on or before `to`', 'validation');
  const compare = (['previous', 'yoy', 'none'] as const).includes(qp.compare as CompareMode) ? (qp.compare as CompareMode) : 'previous';
  const filters: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = parseList(qp[k]);
    if (v) filters[k] = v;
  }
  const range = { from, to };
  return { range, compare, compareRange: comparisonRange(range, compare), filters: normaliseFilters(filters) };
}
