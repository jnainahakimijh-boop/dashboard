import type { FilterQ } from './aggregate';
import { computeInsights, type Insight, type Level } from './insights';

/** ------------------------------------------------------------------
 *  Recommendation backlog. Items derive from computed insights (so the
 *  evidence is real) plus a few standing initiatives. Status changes
 *  are user-editable and persisted locally.
 *  ------------------------------------------------------------------ */

export type RecStatus = 'new' | 'accepted' | 'inprogress' | 'completed' | 'dismissed';

export interface Recommendation {
  id: string;
  priority: Level;
  signal: { en: string; fr: string };
  action: { en: string; fr: string };
  evidence: { en: string; fr: string };
  impact: Level;
  effort: Level;
  owner: string;
  timeline: string;
  status: RecStatus;
}

const OWNER_BY_CATEGORY: Record<Insight['category'], string> = {
  growth: 'Marketing',
  risk: 'Marketing',
  opportunity: 'Marketing',
  anomaly: 'Analytics',
  dataQuality: 'Data Engineering',
  content: 'Content',
  conversion: 'Web',
};

const EFFORT_BY_CATEGORY: Record<Insight['category'], Level> = {
  growth: 'low',
  risk: 'medium',
  opportunity: 'medium',
  anomaly: 'low',
  dataQuality: 'low',
  content: 'medium',
  conversion: 'medium',
};

const STANDING: Omit<Recommendation, 'status'>[] = [
  {
    id: 'std-utm',
    priority: 'medium',
    signal: {
      en: '4.2% of paid sessions arrive without complete UTM tagging',
      fr: '4,2 % des sessions payantes arrivent sans balisage UTM complet',
    },
    action: {
      en: 'Adopt the shared UTM builder for all campaign links and add a CI check to the link sheet.',
      fr: "Adopter le générateur UTM commun pour tous les liens de campagne et ajouter un contrôle automatique.",
    },
    evidence: {
      en: 'UTM completeness check on the Data Quality page — Paid Media source.',
      fr: 'Contrôle de complétude UTM sur la page Qualité des données — source Média payant.',
    },
    impact: 'medium',
    effort: 'low',
    owner: 'Data Engineering',
    timeline: 'Q3',
  },
  {
    id: 'std-alt-lang',
    priority: 'low',
    signal: {
      en: 'French-language content is under-indexed vs French traffic share',
      fr: 'Le contenu francophone est sous-représenté vs la part de trafic français',
    },
    action: {
      en: 'Localise the top 5 performing English articles and measure engagement lift.',
      fr: 'Localiser les 5 meilleurs articles anglophones et mesurer le gain d’engagement.',
    },
    evidence: {
      en: 'France is the largest market (26% of sessions); FR content is 21% of the library.',
      fr: 'La France est le premier marché (26 % des sessions) ; le contenu FR représente 21 % de la bibliothèque.',
    },
    impact: 'medium',
    effort: 'medium',
    owner: 'Content',
    timeline: 'Q4',
  },
];

const STATUS_KEY = 'dp.recStatus';

function loadStatuses(): Record<string, RecStatus> {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStatus(id: string, status: RecStatus): void {
  const map = loadStatuses();
  map[id] = status;
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable */
  }
}

function priorityOf(i: Insight): Level {
  if (i.impact === 'high' && i.confidence === 'high') return 'high';
  if (i.impact === 'high' || i.confidence === 'high') return 'medium';
  return 'low';
}

export function buildRecommendations(q: FilterQ): Recommendation[] {
  const statuses = loadStatuses();
  const fromInsights: Recommendation[] = computeInsights(q)
    .filter((i) => i.category !== 'anomaly')
    .slice(0, 7)
    .map((i) => ({
      id: `rec-${i.id}`,
      priority: priorityOf(i),
      signal: i.signal,
      action: i.action,
      evidence: i.evidence,
      impact: i.impact,
      effort: EFFORT_BY_CATEGORY[i.category],
      owner: OWNER_BY_CATEGORY[i.category],
      timeline: i.impact === 'high' ? '2 weeks' : 'Q3',
      status: statuses[`rec-${i.id}`] ?? 'new',
    }));
  const standing = STANDING.map((s) => ({ ...s, status: statuses[s.id] ?? 'new' }));
  const order: Record<Level, number> = { high: 0, medium: 1, low: 2 };
  return [...fromInsights, ...standing].sort((a, b) => order[a.priority] - order[b.priority]);
}
