import { useState } from 'react';
import { CheckCircle2, Database, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/state/ToastContext';
import { CHECKS, SOURCES, healthScore, type SourceStatus } from '@/lib/dataQuality';
import { fmtInt } from '@/lib/format';
import { Badge, Btn, Card, MiniBar, type BadgeTone } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';
import type { MsgKey } from '@/i18n/messages';

const STATUS_TONE: Record<SourceStatus['status'], BadgeTone> = { healthy: 'pos', degraded: 'warn', stale: 'neg' };
const STATUS_KEY: Record<SourceStatus['status'], MsgKey> = { healthy: 'dq.healthy', degraded: 'dq.degraded', stale: 'dq.stale' };

function refreshLabel(min: number, lang: 'en' | 'fr'): string {
  if (min < 60) return lang === 'fr' ? `il y a ${min} min` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return lang === 'fr' ? `il y a ${h} h` : `${h} h ago`;
  const d = Math.round(h / 24);
  return lang === 'fr' ? `il y a ${d} j` : `${d} d ago`;
}

export default function DataQualityPage() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const score = healthScore();

  const doRefresh = (s: SourceStatus) => {
    setRefreshing(s.id);
    window.setTimeout(() => {
      setRefreshing(null);
      toast(`${s.name}: ${t('adm.integration.testOk')}`, 'info');
    }, 900);
  };

  const cols: Column<SourceStatus>[] = [
    {
      id: 'name',
      header: t('dq.source'),
      cell: (r) => (
        <span className="flex items-center gap-2 text-[12px] font-medium text-t1">
          <Database size={13} className="text-t3" aria-hidden />
          {r.name}
        </span>
      ),
      sortValue: (r) => r.name,
      searchText: (r) => r.name,
    },
    { id: 'status', header: t('dq.status'), cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(STATUS_KEY[r.status]).toUpperCase()}</Badge>, sortValue: (r) => r.status },
    { id: 'refresh', header: t('dq.lastRefresh'), cell: (r) => <Num muted>{refreshLabel(r.lastRefreshMin, lang)}</Num>, sortValue: (r) => r.lastRefreshMin },
    { id: 'freq', header: t('dq.frequency'), cell: (r) => <Num muted>{r.frequency}</Num>, sortValue: (r) => r.frequency },
    { id: 'sla', header: t('dq.sla'), cell: (r) => <Num muted>{`${r.slaHours} h`}</Num>, sortValue: (r) => r.slaHours },
    { id: 'rows', header: t('dq.rows'), align: 'right', sortValue: (r) => r.rows, cell: (r) => <Num>{fmtInt(r.rows, lang)}</Num> },
    {
      id: 'score',
      header: t('dq.score'),
      align: 'right',
      sortValue: (r) => r.score,
      cell: (r) => (
        <span className="flex items-center justify-end gap-2">
          <MiniBar pct={r.score} className="max-w-16" color={r.score >= 90 ? 'var(--pos)' : r.score >= 75 ? 'var(--warn)' : 'var(--neg)'} />
          <Num strong>{r.score}</Num>
        </span>
      ),
    },
    { id: 'issues', header: t('dq.issues'), align: 'right', sortValue: (r) => r.issues, cell: (r) => (r.issues > 0 ? <Badge tone="warn">{r.issues}</Badge> : <Num muted>0</Num>) },
    {
      id: 'actions',
      header: t('adm.actions'),
      align: 'right',
      cell: (r) => (
        <Btn size="sm" onClick={() => doRefresh(r)} disabled={refreshing === r.id} aria-label={`${t('adm.integration.refresh')}: ${r.name}`}>
          <RefreshCw size={11} aria-hidden className={refreshing === r.id ? 'animate-spin' : ''} />
          {refreshing === r.id ? t('adm.integration.syncing') : t('adm.integration.refresh')}
        </Btn>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-[1fr_2fr]">
        <Card title={t('dq.health')} subtitle={t('dq.healthSub')}>
          <div className="flex items-center gap-5">
            <div
              className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${score.total >= 90 ? 'var(--pos)' : score.total >= 75 ? 'var(--warn)' : 'var(--neg)'} ${score.total * 3.6}deg, var(--bg-hover) 0deg)` }}
              role="img"
              aria-label={`${t('dq.health')}: ${score.total}/100`}
            >
              <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-card">
                <span className="mono text-[26px] font-semibold leading-none text-t1 tnum">{score.total}</span>
                <span className="mono text-[9px] text-t3">/100</span>
              </div>
            </div>
            <dl className="m-0 flex flex-1 flex-col gap-2">
              {[
                { label: lang === 'fr' ? 'Fraîcheur (40 %)' : 'Freshness (40%)', v: score.freshness },
                { label: lang === 'fr' ? 'Complétude (40 %)' : 'Completeness (40%)', v: score.completeness },
                { label: lang === 'fr' ? 'Réconciliation (20 %)' : 'Reconciliation (20%)', v: score.reconciliation },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-[11px] text-t3">{row.label}</dt>
                    <dd className="mono m-0 text-[11.5px] text-t1 tnum">{row.v}</dd>
                  </div>
                  <MiniBar pct={row.v} color="var(--ch-2)" className="mt-1" />
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card title={t('dq.checks')} subtitle={t('dq.checksSub')}>
          <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
            {CHECKS.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 rounded-[10px] border border-brd bg-card2 px-3 py-2.5">
                {c.status === 'pass' ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-pos" aria-label={t('dq.check.pass')} />
                ) : c.status === 'warn' ? (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" aria-label={t('dq.check.warn')} />
                ) : (
                  <XCircle size={14} className="mt-0.5 shrink-0 text-neg" aria-label={t('dq.check.fail')} />
                )}
                <div className="min-w-0">
                  <div className="text-[12px] font-medium leading-snug text-t1">{c.label[lang]}</div>
                  <div className="mono mt-0.5 text-[10px] leading-relaxed text-t3 tnum">{c.detail[lang]}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={t('dq.sources')}>
        <DataTable columns={cols} rows={SOURCES} rowKey={(r) => r.id} defaultSort={{ id: 'score', dir: 'asc' }} ariaLabel={t('dq.sources')} />
      </Card>
    </div>
  );
}
