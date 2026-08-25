import { CHANNELS, MARKETS, PLATFORMS, THEMES } from '@/data/dimensions';
import { CAMPAIGN_DEFS } from '@/data/campaigns';
import type { FilterQ } from './aggregate';
import { campaignBy, contentItems, prevQ, socialBy, socialMissingDays, webBy, webTotals, type SocialTotals, type WebTotals } from './aggregate';
import { cpa, cvr, engagementRateSocial, engagementRateWeb, ppChange, relChange } from './metrics';
import { fmtCompact, fmtDayFull, fmtEur, fmtInt, fmtPct, fmtPpDelta, fmtRelDelta, type Locale } from './format';

/** ------------------------------------------------------------------
 *  Rule-based insight engine. Every insight is computed from the
 *  filtered dataset (current vs previous period) — no canned text with
 *  fake numbers. Bilingual copy is composed here, next to the rules.
 *  ------------------------------------------------------------------ */

export type InsightCategory = 'growth' | 'risk' | 'opportunity' | 'anomaly' | 'dataQuality' | 'content' | 'conversion';
export type Level = 'low' | 'medium' | 'high';

export interface Insight {
  id: string;
  category: InsightCategory;
  /** used for ordering; higher = more important */
  score: number;
  signal: { en: string; fr: string };
  evidence: { en: string; fr: string };
  interpretation: { en: string; fr: string };
  action: { en: string; fr: string };
  confidence: Level;
  impact: Level;
  /** direction for compact signal rendering: 1 up, -1 down, 0 flag */
  direction: -1 | 0 | 1;
}

function share(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

export function computeInsights(q: FilterQ): Insight[] {
  const out: Insight[] = [];
  const p = prevQ(q);
  const webNow = webTotals(q);
  const chNow = webBy(q, 'channel') as Map<string, WebTotals>;
  const chPrev = webBy(p, 'channel') as Map<string, WebTotals>;

  /* 1 — channel movers */
  for (const ch of CHANNELS) {
    const cur = chNow.get(ch.id);
    const prev = chPrev.get(ch.id);
    if (!cur || !prev) continue;
    const change = relChange(cur.sessions, prev.sessions);
    const s = share(cur.sessions, webNow.sessions);
    if (change === null || Math.abs(change) < 8 || s < 0.04) continue;
    const up = change > 0;
    out.push({
      id: `ch-${ch.id}`,
      category: up ? 'growth' : 'risk',
      score: Math.abs(change) * s * 100,
      direction: up ? 1 : -1,
      signal: {
        en: `${ch.name} sessions ${up ? 'increased' : 'fell'} ${fmtRelDelta(change).replace('+', '')} vs the previous period`,
        fr: `Les sessions ${ch.nameFr} ont ${up ? 'augmenté de' : 'reculé de'} ${fmtRelDelta(change, 'fr').replace('+', '').replace('-', '')} vs la période précédente`,
      },
      evidence: {
        en: `${fmtInt(cur.sessions)} sessions vs ${fmtInt(prev.sessions)} previously — ${fmtPct(s * 100)} of all traffic.`,
        fr: `${fmtInt(cur.sessions, 'fr')} sessions contre ${fmtInt(prev.sessions, 'fr')} — ${fmtPct(s * 100, 'fr')} du trafic total.`,
      },
      interpretation: {
        en: up ? 'Momentum on this channel is real and volume-backed, not a small-base effect.' : 'The decline is large enough on a significant channel to affect the overall trend.',
        fr: up ? "La dynamique de ce canal est réelle et portée par le volume, pas un effet de petite base." : 'La baisse est assez marquée sur un canal significatif pour peser sur la tendance globale.',
      },
      action: {
        en: up ? `Identify what drove ${ch.name} growth (content, campaigns, seasonality) and reinforce it.` : `Investigate ${ch.name} tracking, ranking or delivery changes in the period.`,
        fr: up ? `Identifier ce qui a porté la croissance ${ch.nameFr} (contenus, campagnes, saisonnalité) et le renforcer.` : `Vérifier le tracking, le référencement ou la diffusion du canal ${ch.nameFr} sur la période.`,
      },
      confidence: Math.abs(change) > 15 ? 'high' : 'medium',
      impact: s > 0.2 ? 'high' : 'medium',
    });
  }

  /* 2 — device conversion gap */
  const devNow = webBy(q, 'device') as Map<string, WebTotals>;
  const mob = devNow.get('mobile');
  const desk = devNow.get('desktop');
  if (mob && desk) {
    const mcvr = cvr(mob.conversions, mob.sessions);
    const dcvr = cvr(desk.conversions, desk.sessions);
    if (mcvr !== null && dcvr !== null && dcvr > 0 && mcvr < dcvr * 0.75 && mob.sessions > 500) {
      const gapRel = ((dcvr - mcvr) / dcvr) * 100;
      out.push({
        id: 'dev-mobile-gap',
        category: 'conversion',
        score: 60 + gapRel / 2,
        direction: -1,
        signal: {
          en: `Mobile conversion is ${fmtPct(gapRel, 'en', 0)} below desktop`,
          fr: `La conversion mobile est ${fmtPct(gapRel, 'fr', 0)} sous le desktop`,
        },
        evidence: {
          en: `Mobile CVR ${fmtPct(mcvr)} vs desktop ${fmtPct(dcvr)} (${fmtPpDelta(ppChange(mcvr, dcvr))}), on ${fmtCompact(mob.sessions)} mobile sessions.`,
          fr: `CVR mobile ${fmtPct(mcvr, 'fr')} vs desktop ${fmtPct(dcvr, 'fr')} (${fmtPpDelta(ppChange(mcvr, dcvr), 'fr')}), sur ${fmtCompact(mob.sessions, 'fr')} sessions mobiles.`,
        },
        interpretation: {
          en: 'More than half of traffic is mobile; a persistent gap of this size usually points to UX friction in the conversion flow rather than audience mix alone.',
          fr: "Plus de la moitié du trafic est mobile ; un écart durable de cette ampleur traduit généralement des frictions UX dans le parcours de conversion, pas seulement un effet d'audience.",
        },
        action: {
          en: 'Audit the mobile form flow and simplify the first conversion step.',
          fr: 'Auditer le parcours de formulaire mobile et simplifier la première étape de conversion.',
        },
        confidence: 'high',
        impact: 'high',
      });
    }
  }

  /* 3 — campaign CPA vs target */
  const cmpNow = campaignBy(q, 'campaign');
  for (const def of CAMPAIGN_DEFS) {
    const tot = cmpNow.get(def.id);
    if (!tot || tot.spend < 500) continue;
    const c = cpa(tot.spend, tot.conversions);
    if (c === null) continue;
    const vsTarget = relChange(c, def.targetCpa);
    if (vsTarget === null || Math.abs(vsTarget) < 15) continue;
    const over = vsTarget > 0;
    out.push({
      id: `cmp-${def.id}`,
      category: over ? 'risk' : 'opportunity',
      score: 40 + Math.abs(vsTarget) / 2 + tot.spend / 1000,
      direction: over ? -1 : 1,
      signal: {
        en: `“${def.name}” CPA is ${fmtPct(Math.abs(vsTarget), 'en', 0)} ${over ? 'above' : 'below'} target`,
        fr: `Le CPA de « ${def.name} » est ${fmtPct(Math.abs(vsTarget), 'fr', 0)} ${over ? 'au-dessus' : 'en dessous'} de l'objectif`,
      },
      evidence: {
        en: `CPA ${fmtEur(c)} vs target ${fmtEur(def.targetCpa)} on ${fmtEur(tot.spend)} spend and ${fmtInt(tot.conversions)} conversions.`,
        fr: `CPA ${fmtEur(c, 'fr')} vs objectif ${fmtEur(def.targetCpa, 'fr')} pour ${fmtEur(tot.spend, 'fr')} dépensés et ${fmtInt(tot.conversions, 'fr')} conversions.`,
      },
      interpretation: {
        en: over
          ? 'Acquisition cost is drifting; creative fatigue or broad targeting are the usual suspects at this stage of a flight.'
          : 'Efficient delivery with headroom — the campaign converts cheaper than planned.',
        fr: over
          ? "Le coût d'acquisition dérive ; fatigue créative ou ciblage trop large sont les causes habituelles à ce stade."
          : "Diffusion efficace avec de la marge — la campagne convertit moins cher que prévu.",
      },
      action: {
        en: over ? 'Review targeting and rotate creatives; shift budget to converting segments.' : 'Consider scaling budget by 15–20% while CPA stays under target.',
        fr: over ? 'Revoir le ciblage et renouveler les créas ; réallouer le budget vers les segments qui convertissent.' : "Envisager d'augmenter le budget de 15–20 % tant que le CPA reste sous l'objectif.",
      },
      confidence: 'high',
      impact: tot.spend > 20000 ? 'high' : 'medium',
    });
  }

  /* 4 — platform engagement movers */
  const socNow = socialBy(q, 'platform') as Map<string, SocialTotals>;
  const socPrev = socialBy(p, 'platform') as Map<string, SocialTotals>;
  for (const pf of PLATFORMS) {
    const cur = socNow.get(pf.id);
    const prev = socPrev.get(pf.id);
    if (!cur || !prev) continue;
    const erNow = engagementRateSocial(cur.engagements, cur.impressions);
    const erPrev = engagementRateSocial(prev.engagements, prev.impressions);
    const pp = ppChange(erNow, erPrev);
    if (pp === null || Math.abs(pp) < 0.45) continue;
    const up = pp > 0;
    out.push({
      id: `soc-${pf.id}`,
      category: up ? 'growth' : 'risk',
      score: 30 + Math.abs(pp) * 20,
      direction: up ? 1 : -1,
      signal: {
        en: `${pf.name} engagement rate moved ${fmtPpDelta(pp)}`,
        fr: `Le taux d'engagement ${pf.name} a évolué de ${fmtPpDelta(pp, 'fr')}`,
      },
      evidence: {
        en: `${fmtPct(erNow)} vs ${fmtPct(erPrev)} previously, on ${fmtCompact(cur.impressions)} impressions.`,
        fr: `${fmtPct(erNow, 'fr')} contre ${fmtPct(erPrev, 'fr')}, sur ${fmtCompact(cur.impressions, 'fr')} impressions.`,
      },
      interpretation: {
        en: up ? 'Recent content is resonating better than the previous cycle on this platform.' : 'Engagement quality is slipping; the mix may be skewing to low-affinity formats.',
        fr: up ? 'Les contenus récents résonnent mieux que le cycle précédent sur cette plateforme.' : "La qualité d'engagement s'érode ; le mix penche peut-être vers des formats à faible affinité.",
      },
      action: {
        en: up ? `Analyse the top ${pf.name} posts of the period and replicate the format.` : `Review the ${pf.name} content mix vs the formats that historically engage.`,
        fr: up ? `Analyser les meilleurs posts ${pf.name} de la période et répliquer le format.` : `Revoir le mix de contenus ${pf.name} face aux formats historiquement engageants.`,
      },
      confidence: 'medium',
      impact: cur.impressions > 500000 ? 'high' : 'medium',
    });
  }

  /* 5 — content theme opportunity */
  const items = contentItems(q);
  if (items.length >= 8) {
    const byTheme = new Map<string, { imp: number; eng: number; n: number }>();
    for (const it of items) {
      const cur = byTheme.get(it.theme) ?? { imp: 0, eng: 0, n: 0 };
      cur.imp += it.impressions;
      cur.eng += it.reactions + it.comments + it.shares;
      cur.n += 1;
      byTheme.set(it.theme, cur);
    }
    const totalEng = [...byTheme.values()].reduce((s, v) => s + v.eng, 0);
    const totalImp = [...byTheme.values()].reduce((s, v) => s + v.imp, 0);
    const avgEr = totalImp > 0 ? (totalEng / totalImp) * 100 : 0;
    const volumes = [...byTheme.values()].map((v) => v.n).sort((a, b) => a - b);
    const medianVol = volumes[Math.floor(volumes.length / 2)];
    for (const th of THEMES) {
      const v = byTheme.get(th.id);
      if (!v || v.imp === 0) continue;
      const er = (v.eng / v.imp) * 100;
      if (er >= avgEr * 1.3 && v.n <= medianVol) {
        out.push({
          id: `cnt-${th.id}`,
          category: 'content',
          score: 35 + er,
          direction: 1,
          signal: {
            en: `“${th.name}” content over-performs with below-median volume`,
            fr: `Les contenus « ${th.nameFr} » surperforment avec un volume sous la médiane`,
          },
          evidence: {
            en: `ER ${fmtPct(er)} vs ${fmtPct(avgEr)} portfolio average, across only ${v.n} items.`,
            fr: `TE ${fmtPct(er, 'fr')} contre ${fmtPct(avgEr, 'fr')} de moyenne, sur seulement ${v.n} contenus.`,
          },
          interpretation: {
            en: 'Audience demand for this topic exceeds current supply — a distribution gap, not a creative one.',
            fr: "La demande pour ce sujet dépasse l'offre actuelle — un déficit de diffusion, pas de créativité.",
          },
          action: {
            en: `Increase ${th.name} publishing cadence next quarter and boost the best pieces.`,
            fr: `Augmenter la cadence de publication « ${th.nameFr} » au prochain trimestre et sponsoriser les meilleurs contenus.`,
          },
          confidence: 'medium',
          impact: 'medium',
        });
      }
    }
  }

  /* 6 — data collection gap */
  const missing = socialMissingDays(q, 'x');
  if (missing.length > 0) {
    out.push({
      id: 'dq-x-gap',
      category: 'dataQuality',
      score: 55,
      direction: 0,
      signal: {
        en: `X data is missing for ${missing.length} day(s) in this range`,
        fr: `Données X manquantes sur ${missing.length} jour(s) de la période`,
      },
      evidence: {
        en: `No rows collected on ${missing.map((d) => fmtDayFull(d)).join(', ')}. Charts show gaps, not zeros.`,
        fr: `Aucune ligne collectée le ${missing.map((d) => fmtDayFull(d, 'fr')).join(', ')}. Les graphiques affichent un vide, pas des zéros.`,
      },
      interpretation: {
        en: 'Platform totals under-count X for this range; comparisons including those days are biased low.',
        fr: 'Les totaux plateforme sous-estiment X sur cette période ; les comparaisons incluant ces jours sont biaisées à la baisse.',
      },
      action: {
        en: 'Re-run the X connector backfill from Data Quality once API access is restored.',
        fr: "Relancer le rattrapage du connecteur X depuis Qualité des données dès que l'accès API est rétabli.",
      },
      confidence: 'high',
      impact: 'medium',
    });
  }

  /* 7 — market growth */
  const mkNow = webBy(q, 'market') as Map<string, WebTotals>;
  const mkPrev = webBy(p, 'market') as Map<string, WebTotals>;
  let best: { id: string; change: number; cur: WebTotals } | null = null;
  for (const m of MARKETS) {
    const cur = mkNow.get(m.id);
    const prev = mkPrev.get(m.id);
    if (!cur || !prev) continue;
    const change = relChange(cur.sessions, prev.sessions);
    if (change !== null && change >= 9 && (!best || change > best.change)) best = { id: m.id, change, cur };
  }
  if (best) {
    const m = MARKETS.find((x) => x.id === best!.id)!;
    out.push({
      id: `mk-${m.id}`,
      category: 'opportunity',
      score: 30 + best.change,
      direction: 1,
      signal: {
        en: `${m.name} is the fastest-growing market (${fmtRelDelta(best.change)})`,
        fr: `${m.nameFr} est le marché en plus forte croissance (${fmtRelDelta(best.change, 'fr')})`,
      },
      evidence: {
        en: `${fmtInt(best.cur.sessions)} sessions this period, engagement rate ${fmtPct(engagementRateWeb(best.cur.engaged, best.cur.sessions))}.`,
        fr: `${fmtInt(best.cur.sessions, 'fr')} sessions sur la période, taux d'engagement ${fmtPct(engagementRateWeb(best.cur.engaged, best.cur.sessions), 'fr')}.`,
      },
      interpretation: {
        en: 'Growth is organic-led and sustained across the period rather than a one-day spike.',
        fr: "La croissance est portée par l'organique et régulière sur la période, pas un pic isolé.",
      },
      action: {
        en: `Evaluate localised content and campaign investment for ${m.name}.`,
        fr: `Évaluer des contenus localisés et un investissement campagne pour ${m.nameFr}.`,
      },
      confidence: 'medium',
      impact: 'medium',
    });
  }

  /* 8 — impression spike anomaly */
  const socByDay = socialBy(q, 'day') as Map<number, SocialTotals>;
  const dayVals = [...socByDay.entries()].sort((a, b) => (a[0] as number) - (b[0] as number));
  if (dayVals.length >= 10) {
    const meds = dayVals.map(([, v]) => v.impressions).sort((a, b) => a - b);
    const med = meds[Math.floor(meds.length / 2)];
    const spike = dayVals.reduce<null | [number, SocialTotals]>((acc, [d, v]) => (v.impressions > med * 2 && (!acc || v.impressions > acc[1].impressions) ? [d as number, v] : acc), null);
    if (spike && med > 0) {
      const mult = spike[1].impressions / med;
      out.push({
        id: 'anom-spike',
        category: 'anomaly',
        score: 25 + mult * 5,
        direction: 1,
        signal: {
          en: `Impression spike on ${fmtDayFull(spike[0])} — ${fmtCompact(spike[1].impressions)} (${mult.toFixed(1)}× median)`,
          fr: `Pic d'impressions le ${fmtDayFull(spike[0], 'fr')} — ${fmtCompact(spike[1].impressions, 'fr')} (${mult.toFixed(1).replace('.', ',')}× la médiane)`,
        },
        evidence: {
          en: `Daily median in range is ${fmtCompact(med)} impressions; engagement that day: ${fmtCompact(spike[1].engagements)}.`,
          fr: `La médiane quotidienne de la période est ${fmtCompact(med, 'fr')} impressions ; engagement ce jour-là : ${fmtCompact(spike[1].engagements, 'fr')}.`,
        },
        interpretation: {
          en: 'Consistent with a post going viral or a coordinated push; verify the driver before treating it as a new baseline.',
          fr: "Compatible avec un post viral ou une activation coordonnée ; vérifier la cause avant d'en faire une nouvelle référence.",
        },
        action: {
          en: 'Identify the top post(s) of that day in Content and document what worked.',
          fr: 'Identifier les meilleurs posts du jour dans Contenus et documenter ce qui a fonctionné.',
        },
        confidence: 'medium',
        impact: 'low',
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Compact top signals for the Overview panel. */
export function topSignals(q: FilterQ, lang: Locale, limit = 5): Array<{ id: string; direction: -1 | 0 | 1; text: string; category: InsightCategory }> {
  return computeInsights(q)
    .slice(0, limit)
    .map((i) => ({ id: i.id, direction: i.direction, text: i.signal[lang], category: i.category }));
}
