/** ------------------------------------------------------------------
 *  GEO sampling adapters. Each monitored prompt is sent as-is (prompts
 *  are public questions, no company data). Answers are analysed for
 *  brand mentions, citations of veolia.com and competitor presence.
 *   - OpenAI Responses API with the web_search tool
 *   - Perplexity chat completions (returns citations)
 *  Disabled until an administrator stores a key and approves use.
 *  ------------------------------------------------------------------ */
import { httpJson, type ConnectorDef } from './types';

export interface GeoAnswer {
  text: string;
  citations: string[];
  model: string | null;
}

export interface GeoAnalysis {
  mentioned: boolean;
  cited: boolean;
  mentionRank: number | null;
  citedUrls: string[];
  citedDomains: string[];
  competitors: string[];
  excerpt: string;
}

export function parseOpenAiResponse(json: unknown): GeoAnswer {
  const j = json as { model?: string; output?: Array<{ type: string; content?: Array<{ type: string; text?: string; annotations?: Array<{ type: string; url?: string }> }> }> };
  const parts = (j.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text');
  return { text: parts.map((p) => p.text ?? '').join('\n'), citations: parts.flatMap((p) => (p.annotations ?? []).filter((a) => a.type === 'url_citation' && a.url).map((a) => a.url!)), model: j.model ?? null };
}

export function parsePerplexityResponse(json: unknown): GeoAnswer {
  const j = json as { model?: string; choices?: Array<{ message?: { content?: string } }>; citations?: string[]; search_results?: Array<{ url?: string }> };
  return { text: j.choices?.[0]?.message?.content ?? '', citations: j.citations ?? (j.search_results ?? []).map((s) => s.url ?? '').filter(Boolean), model: j.model ?? null };
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export function analyseAnswer(ans: GeoAnswer, brandTerms: string[], brandDomain: string, competitors: Array<{ key: string; name: string; domain: string }>): GeoAnalysis {
  const text = ans.text;
  const lower = text.toLowerCase();
  const positions: Array<{ key: string; at: number }> = [];
  const brandAt = Math.min(...brandTerms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0), Infinity);
  if (brandAt !== Infinity) positions.push({ key: '__brand', at: brandAt });
  const compFound: string[] = [];
  for (const c of competitors) {
    const name = c.name.replace(/\s*\(fictional\)\s*/i, '').toLowerCase();
    const at = Math.min(...[lower.indexOf(name), lower.indexOf(c.domain.toLowerCase())].filter((i) => i >= 0), Infinity);
    const citedDomain = ans.citations.some((u) => host(u).endsWith(c.domain.toLowerCase()));
    if (at !== Infinity || citedDomain) {
      compFound.push(c.key);
      positions.push({ key: c.key, at: at === Infinity ? Number.MAX_SAFE_INTEGER : at });
    }
  }
  positions.sort((a, b) => a.at - b.at);
  const rank = positions.findIndex((p) => p.key === '__brand');
  const domains = [...new Set(ans.citations.map(host).filter(Boolean))];
  return {
    mentioned: brandAt !== Infinity,
    cited: domains.some((d) => d === brandDomain || d.endsWith(`.${brandDomain}`)),
    mentionRank: rank >= 0 ? rank + 1 : null,
    citedUrls: ans.citations.slice(0, 30),
    citedDomains: domains.slice(0, 30),
    competitors: compFound,
    excerpt: text.slice(0, 400),
  };
}

export async function askOpenAi(apiKey: string, model: string, prompt: string): Promise<GeoAnswer> {
  const json = await httpJson<unknown>('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: prompt, tools: [{ type: 'web_search' }] }),
    timeoutMs: 90_000,
  });
  return parseOpenAiResponse(json);
}

export async function askPerplexity(apiKey: string, model: string, prompt: string): Promise<GeoAnswer> {
  const json = await httpJson<unknown>('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
    timeoutMs: 90_000,
  });
  return parsePerplexityResponse(json);
}

const geoReadiness = (docs: string[], name: string) => ({
  implementation: 'implemented' as const,
  verifiedLive: false,
  docs,
  credentials: `${name} API key (paid usage — requires authorisation before purchase)`,
  prerequisites: { en: 'Store an API key, choose a model, and approve sending the prompt texts (public questions) to the provider.', fr: 'Enregistrer une clé, choisir un modèle et approuver l’envoi des prompts (questions publiques) au fournisseur.' },
  limitations: { en: 'API answers can differ from what end users see in consumer apps; results vary with model version, location and time. Not tested live from this environment.', fr: 'Les réponses API peuvent différer de celles vues par les utilisateurs ; elles varient selon le modèle, le lieu et le moment. Non testé en réel.' },
});

export const geoOpenAiConnector: ConnectorDef = {
  provider: 'geo_openai',
  label: 'GEO sampling — OpenAI',
  modes: ['api', 'demo'],
  configFields: [
    { key: 'model', label: { en: 'Model', fr: 'Modèle' }, required: true, placeholder: 'model id with web search support' },
    { key: 'brandTerms', label: { en: 'Brand terms (comma-separated)', fr: 'Termes de marque (séparés par des virgules)' }, required: true, placeholder: 'Veolia' },
  ],
  secretFields: [{ key: 'apiKey', label: { en: 'API key', fr: 'Clé API' } }],
  readiness: geoReadiness(['https://platform.openai.com/docs/api-reference/responses', 'https://platform.openai.com/docs/guides/tools-web-search'], 'OpenAI'),
};

export const geoPerplexityConnector: ConnectorDef = {
  provider: 'geo_perplexity',
  label: 'GEO sampling — Perplexity',
  modes: ['api', 'demo'],
  configFields: [
    { key: 'model', label: { en: 'Model', fr: 'Modèle' }, required: true, placeholder: 'sonar' },
    { key: 'brandTerms', label: { en: 'Brand terms (comma-separated)', fr: 'Termes de marque (séparés par des virgules)' }, required: true, placeholder: 'Veolia' },
  ],
  secretFields: [{ key: 'apiKey', label: { en: 'API key', fr: 'Clé API' } }],
  readiness: geoReadiness(['https://docs.perplexity.ai/api-reference/chat-completions'], 'Perplexity'),
};

export const geoManualConnector: ConnectorDef = {
  provider: 'geo_manual',
  label: 'GEO — manual observations',
  modes: ['csv', 'demo'],
  configFields: [],
  secretFields: [],
  readiness: {
    implementation: 'manual_only',
    verifiedLive: true,
    docs: [],
    credentials: 'None — observations are recorded by analysts and imported (CSV/XLSX)',
    prerequisites: { en: 'Use the GEO measurements import template.', fr: 'Utiliser le modèle d’import des mesures GEO.' },
    limitations: { en: 'Google AI features have no official API: low frequency, small sample, observer bias.', fr: 'Pas d’API officielle pour les fonctionnalités IA de Google : faible fréquence, petit échantillon, biais d’observation.' },
  },
};
