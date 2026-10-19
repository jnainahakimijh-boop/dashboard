/** Section A — global filter toolbar: period presets, comparison, dimensions, saved views. */
import clsx from 'clsx';
import { Bookmark, CalendarDays, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RANGE_PRESETS, type CompareMode, type RangePreset } from '@shared/calendar';
import type { FilterKey } from '@shared/filters';
import { api } from '@/api/client';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatRange } from '@/lib/format';
import { useGlobalFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import { Button, Checkbox, Field, Input, Modal, MultiSelect, Popover, Select, useToast } from '@/components/ui';

interface SavedView {
  id: string;
  name: string;
  route: string;
  state: { preset?: RangePreset; from?: string; to?: string; compare?: CompareMode; filters?: Record<string, string[]> };
  shared: boolean;
  isPreset: boolean;
  mine: boolean;
}

export function SavedViewsMenu() {
  const { t } = useI18n();
  const gf = useGlobalFilters();
  const { pathname } = useLocation();
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const views = useApi<SavedView[]>('/api/me/views');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const relevant = (views.data ?? []).filter((v) => v.route === pathname || v.route === '/');
  const save = async () => {
    try {
      await api.send('POST', '/api/me/views', { name, route: pathname, state: gf.snapshot, shared });
      await qc.invalidateQueries({ queryKey: ['/api/me/views'] });
      setSaving(false);
      setName('');
      toast(t('common.saved'), 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <>
      <Popover
        align="right"
        width={320}
        label={t('common.savedViews')}
        trigger={({ toggle, open, id }) => (
          <Button size="sm" variant="ghost" icon={<Bookmark className="size-3.5" />} onClick={toggle} aria-expanded={open} aria-controls={id}>
            <span className="hidden sm:inline">{t('common.savedViews')}</span>
          </Button>
        )}
      >
        {(close) => (
          <div className="flex flex-col gap-1">
            {relevant.length === 0 && <p className="px-2 py-2 text-[13px] text-t2">{t('common.noViews')}</p>}
            {relevant.map((v) => (
              <div key={v.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hov"
                  onClick={() => {
                    gf.applyState({ preset: v.state.preset, from: v.state.from, to: v.state.to, compare: v.state.compare, filters: v.state.filters });
                    close();
                  }}
                >
                  {v.name}
                  {v.shared && <span className="ml-1.5 text-[11px] text-t3">({v.isPreset ? 'preset' : 'shared'})</span>}
                </button>
                {v.mine && !v.isPreset && (
                  <button
                    type="button"
                    className="rounded p-1 text-t3 hover:text-neg"
                    aria-label={`${t('common.deleteView')}: ${v.name}`}
                    onClick={async () => {
                      await api.send('DELETE', `/api/me/views/${v.id}`);
                      void qc.invalidateQueries({ queryKey: ['/api/me/views'] });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="mt-1 border-t border-brd pt-1">
              <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => (close(), setSaving(true))}>
                {t('common.saveView')}
              </Button>
            </div>
          </div>
        )}
      </Popover>
      <Modal
        open={saving}
        onClose={() => setSaving(false)}
        title={t('common.saveView')}
        size="sm"
        footer={
          <>
            <Button onClick={() => setSaving(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={save}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t('common.viewName')} htmlFor="view-name" required>
            <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          {can('views.share') && <Checkbox checked={shared} onChange={setShared} label={t('common.shareView')} />}
        </div>
      </Modal>
    </>
  );
}

const DEFAULT_DIMS: FilterKey[] = ['site', 'country', 'region', 'language', 'channel', 'campaign', 'bu'];

export function FilterToolbar({ dims = DEFAULT_DIMS, extraDims = ['device', 'platform'] }: { dims?: FilterKey[]; extraDims?: FilterKey[] }) {
  const { t, L, lang } = useI18n();
  const gf = useGlobalFilters();
  const meta = useMeta();
  const m = meta.data;
  const [customOpen, setCustomOpen] = useState(false);
  const [dimsOpen, setDimsOpen] = useState(false);
  const [from, setFrom] = useState(gf.range.from);
  const [to, setTo] = useState(gf.range.to);
  const options = (k: FilterKey): Array<{ value: string; label: string; group?: string }> => {
    if (!m) return [];
    switch (k) {
      case 'site':
        return m.sites.map((s) => ({ value: s.key, label: s.name }));
      case 'country':
        return m.catalog.countries.map((c) => ({ value: c.id, label: L(c.name), group: L(m.catalog.regions.find((r) => r.id === c.region)?.name) })).sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
      case 'region':
        return m.catalog.regions.map((r) => ({ value: r.id, label: L(r.name) }));
      case 'language':
        return [
          { value: 'fr', label: L(m.catalog.languages.fr) },
          { value: 'en', label: L(m.catalog.languages.en) },
        ];
      case 'channel':
        return m.catalog.channels.map((c) => ({ value: c.id, label: L(c.name) }));
      case 'device':
        return m.catalog.devices.map((d) => ({ value: d.id, label: L(d.name) }));
      case 'campaign':
        return m.campaigns.map((c) => ({ value: c.key, label: L(c.name) }));
      case 'bu':
        return m.catalog.businessUnits.map((b) => ({ value: b.id, label: L(b.name) }));
      case 'platform':
        return m.catalog.platforms.map((p) => ({ value: p.id, label: p.name }));
    }
  };
  const allKey: Record<FilterKey, string> = { site: 'allSites', country: 'allCountries', region: 'allRegions', language: 'allLanguages', channel: 'allChannels', device: 'allDevices', campaign: 'allCampaigns', bu: 'allBu', platform: 'allPlatforms' };
  const dimControl = (k: FilterKey) => <MultiSelect key={k} label={t(`filters.dim_${k}`)} placeholderAll={t(`filters.${allKey[k]}`)} options={options(k)} value={gf.filters[k] ?? []} onChange={(v) => gf.setFilter(k, v)} />;
  const extraActive = extraDims.filter((k) => gf.filters[k]?.length).length;
  return (
    <div className="no-print border-b border-brd bg-card/60" role="region" aria-label={t('filters.title')}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-t3" aria-hidden />
          <label htmlFor="preset" className="sr-only">
            {t('filters.period')}
          </label>
          <Select
            id="preset"
            value={gf.preset}
            onChange={(e) => {
              const p = e.target.value as RangePreset;
              if (p === 'custom') {
                setFrom(gf.range.from);
                setTo(gf.range.to);
                setCustomOpen(true);
              } else gf.setPreset(p);
            }}
            className="h-8 w-[170px] text-[13px]"
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {t(`filters.preset_${p}`)}
              </option>
            ))}
          </Select>
          <span className="hidden text-[12.5px] text-t2 tnum md:inline">{formatRange(gf.range, lang)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor="compare" className="text-[12.5px] text-t3">
            {t('filters.compare')}
          </label>
          <Select id="compare" value={gf.compare} onChange={(e) => gf.setCompare(e.target.value as CompareMode)} className="h-8 w-[180px] text-[13px]">
            {(['previous', 'yoy', 'none'] as const).map((c) => (
              <option key={c} value={c}>
                {t(`filters.compare_${c}`)}
              </option>
            ))}
          </Select>
        </div>
        <span className="mx-1 hidden h-6 w-px bg-brd lg:block" aria-hidden />
        {/* on phones the dimension filters are folded behind a toggle so content stays visible */}
        <Button size="sm" variant="ghost" className="md:hidden" icon={<SlidersHorizontal className="size-3.5" />} aria-expanded={dimsOpen} aria-controls="dim-filters" onClick={() => setDimsOpen(!dimsOpen)}>
          {t('filters.title')}
          {gf.activeCount > 0 && <span className="rounded-full bg-acc px-1.5 text-[11px] text-white">{gf.activeCount}</span>}
        </Button>
        <div id="dim-filters" className={clsx('flex-wrap items-center gap-1.5 md:flex', dimsOpen ? 'flex w-full' : 'hidden')}>
          {dims.map(dimControl)}
          {extraDims.length > 0 && (
            <Popover
              width={300}
              label={t('filters.moreFilters')}
              trigger={({ toggle, open, id }) => (
                <Button size="sm" variant="ghost" icon={<SlidersHorizontal className="size-3.5" />} onClick={toggle} aria-expanded={open} aria-controls={id}>
                  {t('filters.moreFilters')}
                  {extraActive > 0 && <span className="rounded-full bg-acc px-1.5 text-[11px] text-white">{extraActive}</span>}
                </Button>
              )}
            >
              {() => <div className="flex flex-col items-start gap-2 p-1">{extraDims.map(dimControl)}</div>}
            </Popover>
          )}
          {gf.activeCount > 0 && (
            <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={gf.clearFilters}>
              {t('filters.clearAll')}
            </Button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <SavedViewsMenu />
        </div>
      </div>
      {gf.compareRange && <p className="px-3 pb-2 text-[12px] text-t3 sm:px-5">{t('filters.comparing', { range: formatRange(gf.compareRange, lang) })}</p>}
      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title={t('filters.preset_custom')}
        size="sm"
        footer={
          <>
            <Button onClick={() => setCustomOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!from || !to || from > to}
              onClick={() => {
                gf.setPreset('custom', { from, to });
                setCustomOpen(false);
              }}
            >
              {t('common.apply')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('filters.from')} htmlFor="cf">
            <Input id="cf" type="date" value={from} min={m?.dataStart ?? undefined} max={gf.asOf} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('filters.to')} htmlFor="ct">
            <Input id="ct" type="date" value={to} min={from} max={gf.asOf} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
