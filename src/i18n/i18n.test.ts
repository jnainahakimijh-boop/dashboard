/** Every interface string must exist in English and French, and every literal key used in the code must be defined. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allKeys, translate } from './index';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(f) && !f.endsWith('.test.ts') && !p.endsWith(join('i18n', 'index.tsx')) ? [p] : [];
  });
}

const SRC = join(__dirname, '..');

describe('i18n', () => {
  it('has the same keys in English and French', () => {
    const en = new Set(allKeys('en'));
    const fr = new Set(allKeys('fr'));
    expect([...en].filter((k) => !fr.has(k))).toEqual([]);
    expect([...fr].filter((k) => !en.has(k))).toEqual([]);
  });

  it('defines every literal key used by the web app', () => {
    const known = new Set(allKeys('en'));
    const missing = new Set<string>();
    for (const f of files(SRC)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-z]+\.[A-Za-z0-9_]+)'/g)) if (!known.has(m[1])) missing.add(`${m[1]} (${f.replace(SRC, 'src')})`);
    }
    expect([...missing]).toEqual([]);
  });

  it('defines every key built from a known list of values', () => {
    const dynamic: Array<[string, string[]]> = [
      ['admin.conn_', ['connected', 'disconnected', 'degraded', 'paused', 'not_configured', 'demo']],
      ['admin.section_', ['overview', 'organization', 'users', 'roles', 'integrations', 'websites', 'social', 'advertising', 'seo_geo', 'kpis', 'dashboard', 'alerts', 'data', 'targets', 'reporting', 'ai', 'audit', 'system']],
      ['admin.sectionHint_', ['overview', 'organization', 'users', 'roles', 'integrations', 'websites', 'social', 'advertising', 'seo_geo', 'kpis', 'dashboard', 'alerts', 'data', 'targets', 'reporting', 'ai', 'audit', 'system']],
      ['admin.widget_', ['kpi_grid', 'evolution', 'channels', 'geography', 'content_snapshot', 'targets', 'alerts', 'ai_summary']],
      ['admin.widgetHint_', ['kpi_grid', 'evolution', 'channels', 'geography', 'content_snapshot', 'targets', 'alerts', 'ai_summary']],
      ['admin.cond_', ['above', 'below', 'change_up_pct', 'change_down_pct', 'change_up_abs', 'change_down_abs', 'missing_data', 'pacing_above']],
      ['admin.aiReason_', ['disabled', 'not_configured', 'not_approved', 'no_key', 'feature_not_allowed', 'budget_exceeded', 'ok']],
      ['admin.unit_', ['count', 'percent', 'currency', 'seconds', 'minutes', 'position', 'decimal']],
      ['admin.agg_', ['sum', 'users', 'last', 'ratio', 'diff', 'custom']],
      ['admin.module_', ['web', 'forms', 'search', 'social', 'ads', 'geo']],
      ['admin.geoBlocker_', ['not_api_mode', 'paused', 'no_api_key', 'no_model', 'not_approved']],
      ['admin.job_', ['alerts_evaluate', 'recommendations_generate', 'connectors_sync_all', 'maintenance_cleanup', 'geo_measure_all', 'seo_crawl_all']],
      ['insights.status_', ['new', 'under_review', 'approved', 'in_progress', 'completed', 'dismissed']],
      ['reports.type_', ['executive', 'website', 'social', 'seo', 'geo', 'ads', 'content', 'custom']],
      ['reports.typeHint_', ['executive', 'website', 'social', 'seo', 'geo', 'ads', 'content', 'custom']],
      ['reports.preset_', ['last7', 'last30', 'last90', 'mtd', 'qtd', 'ytd', 'prevMonth', 'prevQuarter', 'prevYear', 'custom']],
      ['content.kind_', ['web_page', 'social_post', 'video']],
    ];
    const known = new Set(allKeys('en'));
    const missing = dynamic.flatMap(([prefix, values]) => values.map((v) => prefix + v).filter((k) => !known.has(k)));
    expect(missing).toEqual([]);
  });

  it('interpolates parameters and falls back to the key when missing', () => {
    expect(translate('fr', 'admin.days', { n: 7 })).toBe('7 jours');
    expect(translate('en', 'nope.missing')).toBe('nope.missing');
  });
});
