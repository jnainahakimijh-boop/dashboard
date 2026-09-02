import { webTotals } from '/src/lib/aggregate.js';
import { seoBy } from '/src/lib/seo.js';
import { dayRng } from '/src/data/random.js';

const ENGINES = [
  { id: 'chatgpt', name: 'ChatGPT', visibility: 0.59, citation: 0.36, traffic: 0.39 },
  { id: 'perplexity', name: 'Perplexity', visibility: 0.54, citation: 0.42, traffic: 0.27 },
  { id: 'google-aio', name: 'Google AI Overviews', visibility: 0.48, citation: 0.30, traffic: 0.22 },
  { id: 'gemini', name: 'Gemini', visibility: 0.44, citation: 0.26, traffic: 0.08 },
  { id: 'copilot', name: 'Microsoft Copilot', visibility: 0.38, citation: 0.22, traffic: 0.04 },
];

const TOPICS = [
  { id: 'water-reuse', en: 'Water reuse & resilience', fr: 'Réutilisation de l’eau & résilience', intent: 'Informational', prompts: 62, visibility: 58, citation: 36, score: 76 },
  { id: 'decarbonisation', en: 'Industrial decarbonisation', fr: 'Décarbonation industrielle', intent: 'Commercial research', prompts: 54, visibility: 46, citation: 29, score: 88 },
  { id: 'circular-economy', en: 'Circular economy', fr: 'Économie circulaire', intent: 'Informational', prompts: 49, visibility: 51, citation: 33, score: 73 },
  { id: 'waste-recovery', en: 'Waste recovery', fr: 'Valorisation des déchets', intent: 'Solution research', prompts: 43, visibility: 42, citation: 25, score: 84 },
  { id: 'energy-efficiency', en: 'Energy efficiency', fr: 'Efficacité énergétique', intent: 'Commercial research', prompts: 47, visibility: 39, citation: 23, score: 91 },
  { id: 'employer-brand', en: 'Employer brand & jobs', fr: 'Marque employeur & recrutement', intent: 'Navigational', prompts: 31, visibility: 64, citation: 41, score: 57 },
];

const PROMPTS = [
  { id: 'p1', en: 'How can cities reduce drinking-water losses?', fr: 'Comment les villes peuvent-elles réduire les pertes d’eau potable ?', topic: 'Water reuse & resilience', intent: 'Informational', engine: 'ChatGPT', visibility: 78, cited: true, seoPosition: 4.2, opportunity: 68 },
  { id: 'p2', en: 'Best industrial decarbonisation solutions for manufacturing', fr: 'Meilleures solutions de décarbonation industrielle pour l’industrie', topic: 'Industrial decarbonisation', intent: 'Commercial research', engine: 'Perplexity', visibility: 42, cited: false, seoPosition: 9.8, opportunity: 94 },
  { id: 'p3', en: 'How does wastewater reuse improve climate resilience?', fr: 'Comment la réutilisation des eaux usées améliore-t-elle la résilience climatique ?', topic: 'Water reuse & resilience', intent: 'Informational', engine: 'Google AI Overviews', visibility: 61, cited: true, seoPosition: 6.1, opportunity: 72 },
  { id: 'p4', en: 'Circular-economy services for large companies', fr: 'Services d’économie circulaire pour les grandes entreprises', topic: 'Circular economy', intent: 'Solution research', engine: 'Gemini', visibility: 37, cited: false, seoPosition: 13.4, opportunity: 90 },
  { id: 'p5', en: 'How to recover energy from non-recyclable waste?', fr: 'Comment valoriser énergétiquement les déchets non recyclables ?', topic: 'Waste recovery', intent: 'Informational', engine: 'ChatGPT', visibility: 49, cited: true, seoPosition: 7.6, opportunity: 80 },
  { id: 'p6', en: 'Energy-efficiency partner for industrial sites', fr: 'Partenaire d’efficacité énergétique pour les sites industriels', topic: 'Energy efficiency', intent: 'Commercial research', engine: 'Perplexity', visibility: 31, cited: false, seoPosition: 15.2, opportunity: 97 },
  { id: 'p7', en: 'What does Veolia do in water and waste management?', fr: 'Que fait Veolia dans la gestion de l’eau et des déchets ?', topic: 'Corporate', intent: 'Navigational', engine: 'Microsoft Copilot', visibility: 83, cited: true, seoPosition: 2.1, opportunity: 52 },
  { id: 'p8', en: 'Environmental jobs and sustainability careers in France', fr: 'Emplois environnement et carrières durables en France', topic: 'Employer brand & jobs', intent: 'Job research', engine: 'Google AI Overviews', visibility: 55, cited: true, seoPosition: 5.9, opportunity: 69 },
];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function sum(arr, key) { return arr.reduce((s, x) => s + (x[key] || 0), 0); }
function allocate(total, weights) {
  let left = Math.max(0, Math.round(total));
  return weights.map((w, i) => {
    if (i === weights.length - 1) return left;
    const v = Math.max(0, Math.round(total * w));
    left -= v;
    return v;
  });
}

export function aiSearchSnapshot(q) {
  const days = Math.max(1, q.to - q.from + 1);
  const selectedMarkets = q.markets.length || 8;
  const scopeFactor = clamp(0.58 + selectedMarkets * 0.055, 0.62, 1.08);
  const seoDays = seoBy(q, 'day');
  const points = [];
  let evaluations = 0, mentions = 0, citations = 0;
  for (let d = q.from; d <= q.to; d++) {
    const seo = seoDays.get(d);
    const rng = dayRng('ai-search-intelligence', d + selectedMarkets * 31);
    const searchSignal = seo ? Math.max(16, seo.impressions / 5200) : 22;
    const evals = Math.max(28, Math.round(searchSignal * scopeFactor * (1 + rng.normal() * 0.05)));
    const mentionRate = clamp(0.46 + rng.normal() * 0.035, 0.34, 0.62);
    const citationRate = clamp(0.27 + rng.normal() * 0.028, 0.18, 0.42);
    const m = Math.min(evals, Math.round(evals * mentionRate));
    const c = Math.min(m, Math.round(evals * citationRate));
    evaluations += evals; mentions += m; citations += c;
    points.push({ d, evaluations: evals, mentions: m, citations: c, visibility: evals ? m / evals * 100 : 0, citationRate: evals ? c / evals * 100 : 0 });
  }

  const organic = webTotals({ ...q, channels: ['organic'], devices: [] });
  const aiSessions = Math.max(0, Math.round(organic.sessions * clamp(0.026 + Math.sin(q.to / 31) * 0.004, 0.018, 0.038)));
  const aiEngaged = Math.round(aiSessions * 0.71);
  const aiConversions = Math.round(aiSessions * 0.037);
  const trackedPrompts = Math.round(390 * scopeFactor);
  const visibilityRate = evaluations ? mentions / evaluations * 100 : null;
  const citationRate = evaluations ? citations / evaluations * 100 : null;
  const aiCvr = aiSessions ? aiConversions / aiSessions * 100 : null;
  const shareOfVoice = clamp(31.4 + Math.sin((q.to + selectedMarkets) / 19) * 2.8, 26, 38);

  const trafficAlloc = allocate(aiSessions, ENGINES.map(x => x.traffic));
  const engineRows = ENGINES.map((e, i) => {
    const wobble = Math.sin((q.to + i * 17) / 29) * 0.025;
    return {
      ...e,
      visibilityPct: clamp((e.visibility + wobble) * 100, 0, 100),
      citationPct: clamp((e.citation + wobble * 0.7) * 100, 0, 100),
      referralSessions: trafficAlloc[i],
      conversions: Math.round(trafficAlloc[i] * clamp(0.032 + i * 0.0025, 0.03, 0.047)),
    };
  });

  const peerA = 27.2, peerB = 22.4;
  const peerC = Math.max(0, 100 - shareOfVoice - peerA - peerB);
  const competitors = [
    { id: 'veolia', label: 'Veolia', value: shareOfVoice },
    { id: 'peer-a', label: 'Peer benchmark A', value: peerA },
    { id: 'peer-b', label: 'Peer benchmark B', value: peerB },
    { id: 'peer-c', label: 'Peer benchmark C', value: peerC },
  ].sort((a, b) => b.value - a.value);

  const sentiment = [
    { id: 'positive', label: 'Positive', value: 46 },
    { id: 'neutral', label: 'Neutral', value: 49 },
    { id: 'caution', label: 'Needs review', value: 5 },
  ];

  const topics = TOPICS.map((t, i) => {
    const scopeWobble = Math.sin((q.to + i * 13 + selectedMarkets) / 23) * 4;
    const visibility = clamp(t.visibility + scopeWobble, 20, 88);
    const citation = clamp(t.citation + scopeWobble * 0.65, 12, visibility - 3);
    return { ...t, visibility, citation, score: clamp(Math.round(t.score - scopeWobble * 0.5), 40, 99) };
  }).sort((a, b) => b.score - a.score);

  const promptRows = PROMPTS.map((r, i) => ({
    ...r,
    visibility: clamp(r.visibility + Math.sin((q.to + i * 11) / 17) * 4, 12, 92),
    opportunity: clamp(Math.round(r.opportunity - Math.sin((q.to + i * 7) / 21) * 3), 35, 99),
  }));

  const citedPages = [
    { id: 'c1', page: '/water/reuse-and-resilience', topic: 'Water reuse', citations: Math.max(12, Math.round(citations * 0.19)), sessions: Math.round(aiSessions * 0.18), conversions: Math.round(aiConversions * 0.21) },
    { id: 'c2', page: '/energy/decarbonisation', topic: 'Decarbonisation', citations: Math.max(10, Math.round(citations * 0.16)), sessions: Math.round(aiSessions * 0.15), conversions: Math.round(aiConversions * 0.18) },
    { id: 'c3', page: '/waste/circular-economy', topic: 'Circular economy', citations: Math.max(9, Math.round(citations * 0.14)), sessions: Math.round(aiSessions * 0.13), conversions: Math.round(aiConversions * 0.14) },
    { id: 'c4', page: '/group/what-we-do', topic: 'Corporate', citations: Math.max(8, Math.round(citations * 0.12)), sessions: Math.round(aiSessions * 0.11), conversions: Math.round(aiConversions * 0.09) },
    { id: 'c5', page: '/careers', topic: 'Employer brand', citations: Math.max(7, Math.round(citations * 0.10)), sessions: Math.round(aiSessions * 0.09), conversions: Math.round(aiConversions * 0.07) },
  ];

  const crawl = {
    aiBotAccessiblePct: 94,
    indexablePct: 97,
    structuredDataPct: 78,
    freshContentPct: 71,
  };

  return {
    days, trackedPrompts, evaluations, mentions, citations, visibilityRate, citationRate, shareOfVoice,
    aiSessions, aiEngaged, aiConversions, aiCvr, organicSessions: organic.sessions, organicEngaged: organic.engaged, organicConversions: organic.conversions,
    points, engineRows, competitors, sentiment, topics, promptRows, citedPages, crawl,
  };
}
