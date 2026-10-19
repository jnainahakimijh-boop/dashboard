import type { ConnectorDef } from './types';
import { ga4Connector, gscConnector } from './google';
import { linkedinConnector, xConnector, youtubeConnector } from './social';
import { chatgptAdsConnector } from './chatgptAds';
import { geoManualConnector, geoOpenAiConnector, geoPerplexityConnector } from './geo';
import { drupalConnector } from './drupal';

const aiProvider: ConnectorDef = {
  provider: 'ai_provider',
  label: 'AI explanations provider',
  modes: ['api'],
  configFields: [],
  secretFields: [{ key: 'apiKey', label: { en: 'API key', fr: 'Clé API' } }],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['https://docs.anthropic.com/en/api/messages', 'https://platform.openai.com/docs/api-reference/chat'],
    credentials: 'API key of an approved AI provider (Anthropic, OpenAI or Azure OpenAI)',
    prerequisites: { en: 'Enable in Administration → AI, choose provider and model, store the key, and record approval to send aggregated, non-personal figures.', fr: 'Activer dans Administration → IA, choisir fournisseur et modèle, enregistrer la clé et l’approbation d’envoi de chiffres agrégés non personnels.' },
    limitations: { en: 'Disabled by default. The model never computes numbers; deterministic summaries are always available.', fr: 'Désactivé par défaut. Le modèle ne calcule aucun chiffre ; les synthèses déterministes restent disponibles.' },
  },
};

const smtp: ConnectorDef = {
  provider: 'smtp',
  label: 'E-mail delivery (SMTP)',
  modes: ['api'],
  configFields: [],
  secretFields: [],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['docs/SETUP.md#e-mail-delivery'],
    credentials: 'SMTP relay configured through environment variables (SMTP_HOST, SMTP_FROM…)',
    prerequisites: { en: 'Set SMTP_* variables on the server. Until then deliveries are recorded as “not sent”.', fr: 'Renseigner les variables SMTP_* sur le serveur. D’ici là les envois sont notés « non envoyés ».' },
    limitations: { en: 'No delivery is attempted without a configured relay.', fr: 'Aucun envoi sans relais configuré.' },
  },
};

const oidc: ConnectorDef = {
  provider: 'oidc',
  label: 'Single sign-on (OpenID Connect)',
  modes: ['api'],
  configFields: [
    { key: 'issuer', label: { en: 'Issuer URL', fr: 'URL de l’émetteur' }, required: true, placeholder: 'https://login.microsoftonline.com/<tenant>/v2.0' },
    { key: 'clientId', label: { en: 'Client id', fr: 'Identifiant client' }, required: true },
  ],
  secretFields: [{ key: 'clientSecret', label: { en: 'Client secret', fr: 'Secret client' } }],
  readiness: {
    implementation: 'partial',
    verifiedLive: false,
    docs: ['https://openid.net/specs/openid-connect-core-1_0.html'],
    credentials: 'App registration in the corporate identity provider',
    prerequisites: { en: 'Register the application with the identity team; provide issuer, client id and secret.', fr: 'Enregistrer l’application auprès de l’équipe identité ; fournir émetteur, identifiant et secret.' },
    limitations: { en: 'Configuration storage and discovery validation only; the sign-in flow is a production blocker to finish with the identity team.', fr: 'Stockage de configuration et validation de découverte uniquement ; le parcours de connexion reste à finaliser avec l’équipe identité.' },
  },
  test: async (_app, conn) => {
    const issuer = String(conn.config.issuer ?? '').replace(/\/$/, '');
    const res = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!res.ok) return { ok: false, message: `Discovery document returned HTTP ${res.status}` };
    const doc = (await res.json()) as { issuer?: string; authorization_endpoint?: string };
    return { ok: !!doc.authorization_endpoint, message: doc.authorization_endpoint ? 'Discovery document valid' : 'Discovery document incomplete' };
  },
};

export const CONNECTORS: Record<string, ConnectorDef> = Object.fromEntries(
  [ga4Connector, gscConnector, linkedinConnector, xConnector, youtubeConnector, chatgptAdsConnector, drupalConnector, geoOpenAiConnector, geoPerplexityConnector, geoManualConnector, aiProvider, smtp, oidc].map((d) => [d.provider, d]),
);

export const CONNECTION_STATUSES = ['connected', 'disconnected', 'degraded', 'paused', 'not_configured', 'demo'] as const;
