/** ------------------------------------------------------------------
 *  Optional LLM explanations. Disabled by default. Calls are made only
 *  when an administrator has (1) enabled a provider, (2) stored its key
 *  (encrypted, server-side) and (3) approved external processing of
 *  aggregated, non-personal metrics. Numbers always come from the
 *  deterministic engine; the model only phrases them.
 *  ------------------------------------------------------------------ */
import { and, desc, eq } from 'drizzle-orm';
import type { AppContext } from '../context';
import { aiExecutions, aiPromptTemplates, aiSettings, dataConnections } from '../db/schema';
import { sha256 } from '../security/crypto';
import { redact, safeErrorMessage } from '../security/redact';

export interface AiStatus {
  available: boolean;
  reason: 'disabled' | 'not_configured' | 'not_approved' | 'no_key' | 'ok';
  provider: string;
  model: string | null;
}

export async function aiStatus(app: AppContext): Promise<AiStatus> {
  const [s] = await app.db.select().from(aiSettings).where(eq(aiSettings.orgId, app.orgId));
  if (!s || !s.enabled) return { available: false, reason: 'disabled', provider: s?.provider ?? 'none', model: s?.model ?? null };
  if (s.provider === 'none' || !s.model) return { available: false, reason: 'not_configured', provider: s.provider, model: s.model };
  if (!s.externalProcessingApproved) return { available: false, reason: 'not_approved', provider: s.provider, model: s.model };
  const [conn] = await app.db.select().from(dataConnections).where(eq(dataConnections.provider, 'ai_provider'));
  if (!conn?.secretCiphertext || !app.secrets.available) return { available: false, reason: 'no_key', provider: s.provider, model: s.model };
  return { available: true, reason: 'ok', provider: s.provider, model: s.model };
}

async function callProvider(provider: string, model: string, baseUrl: string | null, apiKey: string, system: string, user: string, maxTokens: number, temperature: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    if (provider === 'anthropic') {
      const res = await fetch(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] }),
      });
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } };
      if (!res.ok) throw new Error(`Provider returned ${res.status}: ${json.error?.message ?? 'error'}`);
      return { text: (json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim(), inputTokens: json.usage?.input_tokens, outputTokens: json.usage?.output_tokens };
    }
    if (provider === 'openai' || provider === 'azure_openai') {
      const url = provider === 'openai' ? `${baseUrl || 'https://api.openai.com'}/v1/chat/completions` : `${baseUrl}`;
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', ...(provider === 'openai' ? { authorization: `Bearer ${apiKey}` } : { 'api-key': apiKey }) },
        body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number }; error?: { message?: string } };
      if (!res.ok) throw new Error(`Provider returned ${res.status}: ${json.error?.message ?? 'error'}`);
      return { text: json.choices?.[0]?.message?.content?.trim() ?? '', inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens };
    }
    throw new Error(`Unsupported provider ${provider}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Phrase a set of deterministic facts. Returns null (with a reason) when AI is not available. */
export async function explainFacts(app: AppContext, purpose: string, facts: Record<string, unknown>, lang: 'en' | 'fr', userId: string | null): Promise<{ text: string | null; status: AiStatus; executionId?: string }> {
  const status = await aiStatus(app);
  if (!status.available) return { text: null, status };
  const [s] = await app.db.select().from(aiSettings).where(eq(aiSettings.orgId, app.orgId));
  const [conn] = await app.db.select().from(dataConnections).where(eq(dataConnections.provider, 'ai_provider'));
  const [tpl] = await app.db
    .select()
    .from(aiPromptTemplates)
    .where(and(eq(aiPromptTemplates.key, purpose), eq(aiPromptTemplates.active, true)))
    .orderBy(desc(aiPromptTemplates.version))
    .limit(1);
  const safeFacts = redact(facts);
  const factsJson = JSON.stringify(safeFacts).slice(0, 12_000);
  const body = (tpl?.body ?? 'Explain these facts in {{language}} without inventing anything: {{facts}}').replace('{{language}}', lang === 'fr' ? 'French' : 'English').replace('{{facts}}', factsJson);
  const system = 'You are a careful analytics writer. Use only the numbers provided. Never state causes as facts. Mention data limitations. No markdown headings.';
  const started = Date.now();
  try {
    const apiKey = JSON.parse(app.secrets.open(conn!.secretCiphertext!)).apiKey as string;
    const out = await callProvider(s.provider, s.model!, s.baseUrl, apiKey, system, body, s.maxOutputTokens, s.temperature);
    const [exec] = await app.db
      .insert(aiExecutions)
      .values({ orgId: app.orgId, userId, purpose, provider: s.provider, model: s.model, status: 'succeeded', inputHash: sha256(factsJson), inputTokens: out.inputTokens ?? null, outputTokens: out.outputTokens ?? null, latencyMs: Date.now() - started, output: out.text.slice(0, 8000) })
      .returning();
    return { text: out.text, status, executionId: exec.id };
  } catch (err) {
    await app.db.insert(aiExecutions).values({ orgId: app.orgId, userId, purpose, provider: s.provider, model: s.model, status: 'failed', inputHash: sha256(factsJson), latencyMs: Date.now() - started, error: safeErrorMessage(err) });
    return { text: null, status: { ...status, available: false, reason: 'ok' } };
  }
}
