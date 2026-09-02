import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'dp.platform.config.v3';
const EVENT_NAME = 'dp:platform-config';

export const DEFAULT_PLATFORM_CONFIG = {
  workspace: {
    name: 'Veolia Digital Performance',
    organisation: 'Veolia',
    environment: 'Internal prototype',
    owner: 'Group Digital Communication',
    supportEmail: 'digital.support@veolia.demo',
    defaultLanguage: 'fr',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    weekStartsOn: 'monday',
    fiscalYearStart: 'january',
  },
  security: {
    ssoEnabled: true,
    passwordLoginEnabled: true,
    requireMfa: true,
    allowedDomains: 'veolia.com',
    sessionTimeoutMinutes: 60,
    inactivityLockMinutes: 30,
    rememberDeviceDays: 0,
    ipAllowlistEnabled: false,
    ipAllowlist: '',
    exportWatermark: true,
    restrictExports: false,
    auditRetentionMonths: 24,
    dataRetentionMonths: 24,
    piiMasking: true,
    blockPublicSharing: true,
    requireAdminApproval: true,
  },
  data: {
    refreshFrequency: 'hourly',
    freshnessSlaHours: 6,
    qualityThreshold: 95,
    utmCoverageTarget: 95,
    anomalyDetection: true,
    autoRetry: true,
    retryCount: 3,
  },
  reporting: {
    defaultFormat: 'pdf',
    includeMethodology: true,
    includeComparison: true,
    includeDataQuality: true,
    scheduledReports: true,
    approvalRequired: false,
    maxRows: 100000,
  },
  notifications: {
    anomalies: true,
    dataSourceFailures: true,
    targetMisses: true,
    securityEvents: true,
    weeklyDigest: true,
    reportDelivery: true,
    digestDay: 'monday',
    digestHour: '08:00',
  },
  kpis: [
    { id: 'sessions', name: 'Website sessions growth', enabled: true, targetType: 'growth', target: 5, unit: '%', owner: 'Web', alert: true },
    { id: 'engagementRate', name: 'Web engagement rate', enabled: true, targetType: 'min', target: 60, unit: '%', owner: 'Web', alert: true },
    { id: 'conversions', name: 'Conversions growth', enabled: true, targetType: 'growth', target: 8, unit: '%', owner: 'Demand generation', alert: true },
    { id: 'cvr', name: 'Conversion rate', enabled: true, targetType: 'min', target: 3, unit: '%', owner: 'Demand generation', alert: true },
    { id: 'socialEr', name: 'Social engagement rate', enabled: true, targetType: 'min', target: 4, unit: '%', owner: 'Social Media', alert: true },
    { id: 'seoCtr', name: 'Organic search CTR', enabled: true, targetType: 'min', target: 3.5, unit: '%', owner: 'SEO', alert: true },
    { id: 'advocacyParticipation', name: 'Advocacy participation', enabled: true, targetType: 'min', target: 55, unit: '%', owner: 'Employee Advocacy', alert: true },
    { id: 'campaignCpa', name: 'Campaign CPA', enabled: true, targetType: 'max', target: 35, unit: '€', owner: 'Campaigns', alert: true },
  ],
  users: [
    { id: 'u1', name: 'Priya Sharma', email: 'priya.sharma@veolia.example', role: 'Administrator', scope: 'Global', status: 'active' },
    { id: 'u2', name: 'Alex Moreau', email: 'alex.moreau@veolia.example', role: 'Analyst', scope: 'Global', status: 'active' },
    { id: 'u3', name: 'Jonas Weber', email: 'jonas.weber@veolia.example', role: 'Editor', scope: 'DACH', status: 'active' },
    { id: 'u4', name: 'Marta Kowalska', email: 'marta.kowalska@veolia.example', role: 'Webmaster', scope: 'Poland', status: 'active' },
    { id: 'u5', name: 'Sofia Ruiz', email: 'sofia.ruiz@veolia.example', role: 'Viewer', scope: 'Spain', status: 'invited' },
  ],
  roles: [
    { id: 'Administrator', label: 'Administrator', permissions: ['view','export','reports','kpis','integrations','users','security','audit','settings'] },
    { id: 'Executive', label: 'Executive', permissions: ['view','export','reports'] },
    { id: 'Analyst', label: 'Analyst', permissions: ['view','export','reports','kpis','audit'] },
    { id: 'Editor', label: 'Editor', permissions: ['view','export','reports'] },
    { id: 'Social Media Manager', label: 'Social Media Manager', permissions: ['view','export','reports'] },
    { id: 'Webmaster', label: 'Webmaster', permissions: ['view','export','reports'] },
    { id: 'Employee Advocacy Manager', label: 'Employee Advocacy Manager', permissions: ['view','export','reports'] },
    { id: 'Viewer', label: 'Viewer', permissions: ['view'] },
  ],
  integrations: [
    { id: 'ga4', name: 'Google Analytics 4', status: 'connected', frequency: '15 min', enabled: true, health: 98 },
    { id: 'gsc', name: 'Google Search Console', status: 'connected', frequency: '6 h', enabled: true, health: 97 },
    { id: 'linkedin', name: 'LinkedIn', status: 'connected', frequency: '1 h', enabled: true, health: 96 },
    { id: 'meta', name: 'Instagram / Meta', status: 'connected', frequency: '1 h', enabled: true, health: 95 },
    { id: 'youtube', name: 'YouTube', status: 'connected', frequency: '6 h', enabled: true, health: 95 },
    { id: 'x', name: 'X', status: 'degraded', frequency: '6 h', enabled: true, health: 71 },
    { id: 'tiktok', name: 'TikTok', status: 'connected', frequency: '6 h', enabled: true, health: 92 },
    { id: 'advocacy', name: 'Employee Advocacy Platform', status: 'connected', frequency: '3 h', enabled: true, health: 94 },
    { id: 'cms', name: 'CMS / Drupal', status: 'connected', frequency: '1 h', enabled: true, health: 97 },
    { id: 'crm', name: 'CRM', status: 'connected', frequency: '24 h', enabled: true, health: 93 },
    { id: 'paid', name: 'Paid Media', status: 'connected', frequency: '3 h', enabled: true, health: 91 },
    { id: 'dwh', name: 'Data Warehouse', status: 'connected', frequency: '1 h', enabled: true, health: 97 },
    { id: 'ai-search', name: 'AI Search Intelligence', status: 'prototype', frequency: '24 h', enabled: true, health: 90 },
  ],
  taxonomy: {
    markets: ['France','United Kingdom','Germany','Spain','Poland','United States'],
    themes: ['Sustainability','Innovation','Corporate','Employer Branding','CSR','Events','Thought Leadership','Business','Press','People','Products & Services'],
    contentTypes: ['Video','Image','Carousel','Article','Link','Text','Story','Reel / Short'],
    channels: ['Organic Search','Direct','Social','Employee Advocacy','Referral','Email','Paid'],
  },
  flags: [
    { id: 'ai-recs', name: 'AI recommendations', enabled: true },
    { id: 'ai-search', name: 'AI Search / AEO intelligence', enabled: true },
    { id: 'benchmarks', name: 'Advanced benchmarking', enabled: false },
    { id: 'scheduled-exports', name: 'Scheduled reports', enabled: true },
    { id: 'experimental-attribution', name: 'Experimental attribution model', enabled: false },
    { id: 'audience-enrichment', name: 'Audience enrichment', enabled: false },
  ],
  audit: [
    { id: 'a1', time: 'Today 14:32', user: 'Priya Sharma', action: 'Updated Analyst permissions', object: 'Role', result: 'Success' },
    { id: 'a2', time: 'Today 13:58', user: 'Priya Sharma', action: 'Invited Sofia Ruiz', object: 'User', result: 'Success' },
    { id: 'a3', time: 'Today 11:41', user: 'System', action: 'X connector sync failed (401)', object: 'Integration', result: 'Warning' },
    { id: 'a4', time: 'Today 09:15', user: 'Alex Moreau', action: 'Exported Executive Overview PDF', object: 'Report', result: 'Success' },
    { id: 'a5', time: 'Yesterday 18:03', user: 'Jonas Weber', action: 'Edited KPI target: CPA', object: 'KPI', result: 'Success' },
  ],
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return patch === undefined ? clone(base) : clone(patch);
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const key of Object.keys(patch || {})) out[key] = key in base ? deepMerge(base[key], patch[key]) : clone(patch[key]);
    return out;
  }
  return patch === undefined ? base : patch;
}
export function loadPlatformConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_PLATFORM_CONFIG);
    return deepMerge(DEFAULT_PLATFORM_CONFIG, JSON.parse(raw));
  } catch { return clone(DEFAULT_PLATFORM_CONFIG); }
}
export function savePlatformConfig(config) {
  const next = deepMerge(DEFAULT_PLATFORM_CONFIG, config);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next })); } catch { /* ignore */ }
  return next;
}
export function resetPlatformConfig() {
  const next = clone(DEFAULT_PLATFORM_CONFIG);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next })); } catch { /* ignore */ }
  return next;
}
export function usePlatformConfig() {
  const [config, setConfig] = useState(loadPlatformConfig);
  useEffect(() => {
    const sync = (e) => setConfig(e?.detail ? deepMerge(DEFAULT_PLATFORM_CONFIG, e.detail) : loadPlatformConfig());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT_NAME, sync); window.removeEventListener('storage', sync); };
  }, []);
  const updateConfig = (updater) => {
    setConfig(prev => {
      const next = typeof updater === 'function' ? updater(prev) : deepMerge(prev, updater);
      return savePlatformConfig(next);
    });
  };
  return { config, updateConfig, resetConfig: () => setConfig(resetPlatformConfig()) };
}
