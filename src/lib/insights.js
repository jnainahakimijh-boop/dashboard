import { CHANNELS, MARKETS, PLATFORMS, THEMES } from '/src/data/dimensions.js';
import { CAMPAIGN_DEFS } from '/src/data/campaigns.js';
import { campaignBy, contentItems, prevQ, socialBy, socialMissingDays, webBy, webTotals } from '/src/lib/aggregate.js';
import { bounceRate, cpa, cvr, engagementRateSocial, engagementRateWeb, ppChange, relChange } from '/src/lib/metrics.js';
import { advocacyTotals } from '/src/lib/advocacy.js';
import { seoTotals } from '/src/lib/seo.js';
import { fmtCompact, fmtDayFull, fmtEur, fmtInt, fmtPct, fmtPpDelta, fmtRelDelta } from '/src/lib/format.js';
function share(part, total) {
    return total > 0 ? part / total : 0;
}
export function computeInsights(q, options = {}) {
    const out = [];
    const p = prevQ(q);
    const webNow = webTotals(q);
    const webPrev = webTotals(p);
    const advocacyNow = advocacyTotals(q, options.advocacyPrograms ?? [], options.advocateGroups ?? []);
    const advocacyPrev = advocacyTotals(p, options.advocacyPrograms ?? [], options.advocateGroups ?? []);
    const seoNow = seoTotals(q);
    const seoPrev = seoTotals(p);
    const chNow = webBy(q, 'channel');
    const chPrev = webBy(p, 'channel');
    /* 1 — channel movers */
    for (const ch of CHANNELS) {
        const cur = chNow.get(ch.id);
        const prev = chPrev.get(ch.id);
        if (!cur || !prev)
            continue;
        const change = relChange(cur.sessions, prev.sessions);
        const s = share(cur.sessions, webNow.sessions);
        if (change === null || Math.abs(change) < 8 || s < 0.04)
            continue;
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
    /* 1b — bounce-rate deterioration / improvement */
    const bounceNow = bounceRate(webNow.engaged, webNow.sessions);
    const bouncePrev = bounceRate(webPrev.engaged, webPrev.sessions);
    const bouncePp = ppChange(bounceNow, bouncePrev);
    if (bouncePp !== null && Math.abs(bouncePp) >= 3 && webNow.sessions > 500) {
        const worsening = bouncePp > 0;
        out.push({
            id: 'web-bounce',
            category: worsening ? 'risk' : 'growth',
            score: 48 + Math.abs(bouncePp) * 5,
            direction: worsening ? -1 : 1,
            signal: {
                en: `Website bounce rate ${worsening ? 'increased' : 'improved'} ${fmtPpDelta(bouncePp)}`,
                fr: `Le taux de rebond web s’est ${worsening ? 'dégradé' : 'amélioré'} de ${fmtPpDelta(bouncePp, 'fr')}`,
            },
            evidence: {
                en: `${fmtPct(bounceNow)} now vs ${fmtPct(bouncePrev)} in the previous period, across ${fmtCompact(webNow.sessions)} sessions.`,
                fr: `${fmtPct(bounceNow, 'fr')} actuellement vs ${fmtPct(bouncePrev, 'fr')} sur la période précédente, pour ${fmtCompact(webNow.sessions, 'fr')} sessions.`,
            },
            interpretation: {
                en: worsening ? 'More sessions are failing the engaged-session criteria; interpret this alongside traffic source, device, page purpose and conversion.' : 'A larger share of sessions now meet engaged-session criteria, improving visit quality.',
                fr: worsening ? "Davantage de sessions ne remplissent pas les critères de session engagée ; à lire avec la source, l’appareil, l’intention de page et la conversion." : 'Une plus grande part des sessions répond désormais aux critères de session engagée, ce qui améliore la qualité des visites.',
            },
            action: {
                en: worsening ? 'Inspect high-traffic/high-bounce landing pages, especially mobile and campaign traffic, before changing acquisition spend.' : 'Identify the pages and sources driving the improvement and reuse their experience patterns.',
                fr: worsening ? 'Examiner les landing pages à fort trafic et fort rebond, surtout sur mobile et campagnes, avant de modifier les investissements d’acquisition.' : 'Identifier les pages et sources à l’origine de l’amélioration et répliquer leurs bonnes pratiques.',
            },
            confidence: 'high', impact: Math.abs(bouncePp) >= 6 ? 'high' : 'medium',
        });
    }
    /* 1c — employee-advocacy participation */
    const advPartNow = advocacyNow.registered ? advocacyNow.active / advocacyNow.registered * 100 : null;
    const advPartPrev = advocacyPrev.registered ? advocacyPrev.active / advocacyPrev.registered * 100 : null;
    const advPp = ppChange(advPartNow, advPartPrev);
    if (advPp !== null && Math.abs(advPp) >= 2 && advocacyNow.registered > 20) {
        const up = advPp > 0;
        out.push({
            id: 'adv-participation', category: up ? 'opportunity' : 'risk', score: 42 + Math.abs(advPp) * 4, direction: up ? 1 : -1,
            signal: { en: `Employee Advocacy participation ${up ? 'rose' : 'fell'} ${fmtPpDelta(advPp)}`, fr: `La participation Employee Advocacy a ${up ? 'progressé' : 'reculé'} de ${fmtPpDelta(advPp, 'fr')}` },
            evidence: { en: `${fmtCompact(advocacyNow.active)} active advocates out of ${fmtCompact(advocacyNow.registered)} registered; advocacy generated ${fmtCompact(advocacyNow.sessions)} attributed web sessions.`, fr: `${fmtCompact(advocacyNow.active, 'fr')} ambassadeurs actifs sur ${fmtCompact(advocacyNow.registered, 'fr')} inscrits ; l’advocacy a généré ${fmtCompact(advocacyNow.sessions, 'fr')} sessions web attribuées.` },
            interpretation: { en: up ? 'Programme adoption is strengthening and can amplify high-value content beyond corporate accounts.' : 'A participation decline can reduce organic amplification even when corporate publishing volume is stable.', fr: up ? 'L’adoption du programme progresse et peut amplifier les contenus à forte valeur au-delà des comptes corporate.' : 'Une baisse de participation peut réduire l’amplification organique même si le volume de publication corporate reste stable.' },
            action: { en: up ? 'Identify the programmes and advocate groups contributing most, then extend the successful activation pattern.' : 'Review programme activation by group and re-engage inactive advocates with a smaller set of high-performing assets.', fr: up ? 'Identifier les programmes et groupes qui contribuent le plus, puis étendre le modèle d’activation performant.' : 'Analyser l’activation par groupe et réengager les ambassadeurs inactifs avec une sélection plus courte de contenus performants.' },
            confidence: 'medium', impact: 'medium',
        });
    }
    /* 1d — SEO visibility / click efficiency */
    const seoImpChange = relChange(seoNow.impressions, seoPrev.impressions);
    const seoCtrNow = seoNow.impressions ? seoNow.clicks / seoNow.impressions * 100 : null;
    const seoCtrPrev = seoPrev.impressions ? seoPrev.clicks / seoPrev.impressions * 100 : null;
    const seoCtrPp = ppChange(seoCtrNow, seoCtrPrev);
    if (seoImpChange !== null && Math.abs(seoImpChange) >= 10 && seoNow.impressions > 1000) {
        const up = seoImpChange > 0;
        out.push({
            id: 'seo-visibility', category: up ? 'opportunity' : 'risk', score: 38 + Math.abs(seoImpChange) / 2, direction: up ? 1 : -1,
            signal: { en: `Organic search visibility ${up ? 'increased' : 'declined'} ${fmtRelDelta(seoImpChange).replace('+', '')}`, fr: `La visibilité organique a ${up ? 'progressé' : 'reculé'} de ${fmtRelDelta(seoImpChange, 'fr').replace('+', '').replace('-', '')}` },
            evidence: { en: `${fmtCompact(seoNow.impressions)} search impressions and ${fmtCompact(seoNow.clicks)} clicks; CTR ${fmtPct(seoCtrNow)} (${fmtPpDelta(seoCtrPp)}).`, fr: `${fmtCompact(seoNow.impressions, 'fr')} impressions Search et ${fmtCompact(seoNow.clicks, 'fr')} clics ; CTR ${fmtPct(seoCtrNow, 'fr')} (${fmtPpDelta(seoCtrPp, 'fr')}).` },
            interpretation: { en: up ? 'Search demand or rankings are expanding. CTR determines whether that additional visibility is translating into traffic.' : 'The site is appearing less often in search; query and landing-page diagnostics can isolate whether rankings or demand are responsible.', fr: up ? 'La demande ou les positions progressent. Le CTR indique si cette visibilité supplémentaire se transforme réellement en trafic.' : 'Le site apparaît moins souvent dans les résultats ; l’analyse requêtes/landing pages permet d’isoler un effet de positionnement ou de demande.' },
            action: { en: up ? 'Prioritise high-impression queries in positions 4–15 and improve low-CTR snippets to convert visibility into clicks.' : 'Review lost-impression queries, ranking pages and technical crawl signals before changing content priorities.', fr: up ? 'Prioriser les requêtes à fortes impressions en positions 4–15 et optimiser les snippets à faible CTR.' : 'Examiner les requêtes en perte d’impressions, les pages positionnées et les signaux techniques de crawl avant de modifier les priorités éditoriales.' },
            confidence: 'medium', impact: 'medium',
        });
    }
    /* 2 — device conversion gap */
    const devNow = webBy(q, 'device');
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
        if (!tot || tot.spend < 500)
            continue;
        const c = cpa(tot.spend, tot.conversions);
        if (c === null)
            continue;
        const vsTarget = relChange(c, def.targetCpa);
        if (vsTarget === null || Math.abs(vsTarget) < 15)
            continue;
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
    const socNow = socialBy(q, 'platform');
    const socPrev = socialBy(p, 'platform');
    for (const pf of PLATFORMS) {
        const cur = socNow.get(pf.id);
        const prev = socPrev.get(pf.id);
        if (!cur || !prev)
            continue;
        const erNow = engagementRateSocial(cur.engagements, cur.impressions);
        const erPrev = engagementRateSocial(prev.engagements, prev.impressions);
        const pp = ppChange(erNow, erPrev);
        if (pp === null || Math.abs(pp) < 0.45)
            continue;
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
        const byTheme = new Map();
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
            if (!v || v.imp === 0)
                continue;
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
    const mkNow = webBy(q, 'market');
    const mkPrev = webBy(p, 'market');
    let best = null;
    for (const m of MARKETS) {
        const cur = mkNow.get(m.id);
        const prev = mkPrev.get(m.id);
        if (!cur || !prev)
            continue;
        const change = relChange(cur.sessions, prev.sessions);
        if (change !== null && change >= 9 && (!best || change > best.change))
            best = { id: m.id, change, cur };
    }
    if (best) {
        const m = MARKETS.find((x) => x.id === best.id);
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
    const socByDay = socialBy(q, 'day');
    const dayVals = [...socByDay.entries()].sort((a, b) => a[0] - b[0]);
    if (dayVals.length >= 10) {
        const meds = dayVals.map(([, v]) => v.impressions).sort((a, b) => a - b);
        const med = meds[Math.floor(meds.length / 2)];
        const spike = dayVals.reduce((acc, [d, v]) => (v.impressions > med * 2 && (!acc || v.impressions > acc[1].impressions) ? [d, v] : acc), null);
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
export function topSignals(q, lang, limit = 5, options = {}) {
    return computeInsights(q, options)
        .slice(0, limit)
        .map((i) => ({ id: i.id, direction: i.direction, text: i.signal[lang], category: i.category }));
}
