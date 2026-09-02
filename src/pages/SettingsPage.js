import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, Bell, Database, FileDown, Globe2, History, KeyRound, Lock,
  RefreshCw, Settings2, ShieldCheck, SlidersHorizontal, Tags, Target,
  UserRound, Users
} from 'lucide-react';
import { useSettings } from '/src/state/SettingsContext.js';
import { useToast } from '/src/state/ToastContext.js';
import { useAuth } from '/src/state/AuthContext.js';
import { usePlatformConfig } from '/src/lib/platformConfig.js';
import { Badge, Btn, Card, Segmented } from '/src/components/ui/primitives.js';

const h = React.createElement;
const personalSections = ['profile', 'appearance', 'defaults', 'notifications', 'exports', 'session'];
/** Older links (and the header menu) use earlier section names; keep them working. */
const SECTION_ALIASES = { account: 'profile', dashboard: 'defaults', preferences: 'appearance', security: 'session' };
const resolveSection = (raw) => SECTION_ALIASES[raw] ?? raw;
const adminSections = ['overview', 'workspace', 'users', 'roles', 'integrations', 'kpis', 'taxonomy', 'security', 'alerts', 'reports', 'data', 'features', 'api', 'audit'];
const inputClass = 'h-9 min-w-[220px] rounded-[6px] border border-brd bg-card px-3 text-[12px] text-t1 outline-none focus:border-acc';
const smallInputClass = 'h-9 w-28 rounded-[6px] border border-brd bg-card px-3 text-[12px] text-t1 outline-none focus:border-acc';

function Switch({ checked, onChange, label }) {
  return h('button', {
    type: 'button', role: 'switch', 'aria-checked': Boolean(checked), 'aria-label': label,
    onClick: () => onChange(!checked),
    className: `relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-acc bg-acc' : 'border-brds bg-inset'}`
  }, h('span', { className: `absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[24px]' : 'left-[3px]'}` }));
}

function Row({ label, hint, children }) {
  return h('div', { className: 'flex flex-wrap items-center justify-between gap-4 border-b border-brd py-3.5 last:border-0' },
    h('div', { className: 'min-w-[220px] flex-1' },
      h('div', { className: 'text-[12px] font-semibold text-t1' }, label),
      hint ? h('div', { className: 'mt-0.5 max-w-2xl text-[10.5px] leading-4 text-t3' }, hint) : null
    ),
    h('div', { className: 'shrink-0' }, children)
  );
}

function Stat({ label, value, tone = 'neutral' }) {
  return h('div', { className: 'rounded-[7px] border border-brd bg-card2 p-4' },
    h('div', { className: 'text-[9px] font-bold uppercase tracking-[.08em] text-t3' }, label),
    h('div', { className: 'mt-2 flex items-center gap-2' },
      h('span', { className: 'text-[21px] font-bold text-t1 tnum' }, value),
      tone !== 'neutral' ? h(Badge, { tone }, tone === 'pos' ? 'OK' : tone === 'warn' ? 'WATCH' : 'ACTION') : null
    )
  );
}

function SectionHeader({ title, description }) {
  return h('div', { className: 'mb-4' },
    h('h2', { className: 'm-0 text-[16px] font-semibold text-t1' }, title),
    description ? h('p', { className: 'm-0 mt-1 max-w-3xl text-[11px] leading-5 text-t3' }, description) : null
  );
}

function SimpleTable({ columns, rows }) {
  return h('div', { className: 'overflow-x-auto rounded-[7px] border border-brd' },
    h('table', { className: 'w-full min-w-[720px] border-collapse text-left' },
      h('thead', null, h('tr', { className: 'bg-card2' }, columns.map((col) => h('th', { key: col.id, className: 'border-b border-brd px-3 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-t3' }, col.label)))),
      h('tbody', null, rows.map((row) => h('tr', { key: row.id, className: 'border-b border-brd last:border-0 hover:bg-hov' }, columns.map((col) => h('td', { key: col.id, className: 'px-3 py-2.5 text-[11px] text-t2' }, col.render ? col.render(row) : String(row[col.id] ?? '—'))))))
    )
  );
}

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { config, updateConfig, resetConfig } = usePlatformConfig();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();

  const requested = resolveSection(params.get('section') || 'profile');
  const requestedAdmin = requested === 'backoffice' ? 'overview' : requested.startsWith('admin-') ? requested.slice(6) : null;
  const [mode, setMode] = useState(requestedAdmin ? 'admin' : 'personal');
  const [personalSection, setPersonalSection] = useState(personalSections.includes(requested) ? requested : 'profile');
  const [adminSection, setAdminSection] = useState(requestedAdmin && adminSections.includes(requestedAdmin) ? requestedAdmin : 'overview');

  useEffect(() => {
    const value = resolveSection(params.get('section') || 'profile');
    if (value === 'backoffice' || value.startsWith('admin-')) {
      const id = value === 'backoffice' ? 'overview' : value.slice(6);
      setMode('admin');
      setAdminSection(adminSections.includes(id) ? id : 'overview');
    } else {
      setMode('personal');
      setPersonalSection(personalSections.includes(value) ? value : 'profile');
    }
  }, [params]);

  const saveSettings = (patch) => {
    update(patch);
    toast('Setting saved');
  };
  const patchSection = (section, patch) => updateConfig((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  const patchTaxonomy = (key, value) => updateConfig((prev) => ({ ...prev, taxonomy: { ...prev.taxonomy, [key]: value } }));
  const updateArrayItem = (key, id, patch) => updateConfig((prev) => ({ ...prev, [key]: prev[key].map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const removeArrayItem = (key, id) => updateConfig((prev) => ({ ...prev, [key]: prev[key].filter((item) => item.id !== id) }));

  const openPersonal = (id) => { setMode('personal'); setPersonalSection(id); setParams({ section: id }, { replace: true }); };
  const openAdmin = (id) => { setMode('admin'); setAdminSection(id); setParams({ section: `admin-${id}` }, { replace: true }); };

  const personalNav = [
    ['profile', 'Profile & language', UserRound],
    ['appearance', 'Appearance & accessibility', SlidersHorizontal],
    ['defaults', 'Dashboard defaults', Target],
    ['notifications', 'Notification preferences', Bell],
    ['exports', 'Export preferences', FileDown],
    ['session', 'Session & security', ShieldCheck]
  ];
  const adminNav = [
    ['overview', 'System overview', Activity],
    ['workspace', 'Workspace & localisation', Globe2],
    ['users', 'Users', Users],
    ['roles', 'Roles & permissions', ShieldCheck],
    ['integrations', 'Data sources & integrations', Database],
    ['kpis', 'KPIs, targets & governance', Target],
    ['taxonomy', 'Taxonomy', Tags],
    ['security', 'Security & authentication', Lock],
    ['alerts', 'Alerts & notifications', Bell],
    ['reports', 'Reports & exports', FileDown],
    ['data', 'Data, privacy & compliance', ShieldCheck],
    ['features', 'Feature flags', Settings2],
    ['api', 'API & webhooks', KeyRound],
    ['audit', 'Audit history', History]
  ];

  const sessionStarted = useMemo(() => {
    const raw = user?.signedInAt;
    const date = raw ? new Date(raw) : new Date();
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat(settings.lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }, [user, settings.lang]);

  const activeIntegrations = config.integrations.filter((x) => x.enabled).length;
  const healthyIntegrations = config.integrations.filter((x) => x.enabled && x.health >= 90).length;
  const activeUsers = config.users.filter((x) => x.status === 'active').length;
  const enabledKpis = config.kpis.filter((x) => x.enabled).length;

  let content = null;

  if (mode === 'personal' && personalSection === 'profile') {
    content = h(Card, { title: 'Profile & account', subtitle: 'Identity displayed in the prototype and current sign-in information.' },
      h('div', { className: 'mb-4 flex items-center gap-4 rounded-[7px] border border-brd bg-card2 p-4' },
        h('span', { className: 'flex h-12 w-12 items-center justify-center rounded-full bg-[#002d62] text-[14px] font-bold text-white' }, 'VD'),
        h('div', { className: 'min-w-0 flex-1' },
          h('div', { className: 'text-[15px] font-bold text-t1' }, user?.name || settings.profileName),
          h('div', { className: 'mt-0.5 text-[11px] text-t3' }, user?.email || settings.profileEmail),
          h('div', { className: 'mt-2 flex flex-wrap gap-2' }, h(Badge, { tone: 'info' }, user?.role || settings.profileRole), h(Badge, { tone: 'pos' }, user?.provider || 'prototype'))
        )
      ),
      h(Row, { label: 'Display name' }, h('input', { className: inputClass, value: settings.profileName, onChange: (e) => update({ profileName: e.target.value }), onBlur: () => toast('Profile saved') })),
      h(Row, { label: 'Display role', hint: 'This label does not replace real permissions configured in the Back Office.' }, h('select', { className: inputClass, value: settings.profileRole, onChange: (e) => saveSettings({ profileRole: e.target.value }) }, ['Administrator','Executive','Analyst','Editor','Social Media Manager','Webmaster','Employee Advocacy Manager','Viewer'].map((v) => h('option', { key: v, value: v }, v)))),
      h(Row, { label: 'Interface language' }, h('select', { className: inputClass, value: settings.lang, onChange: (e) => saveSettings({ lang: e.target.value }) }, h('option', { value: 'en' }, 'English'), h('option', { value: 'fr' }, 'Fran\u00e7ais'))),
      h(Row, { label: 'Timezone', hint: 'Used for report scheduling labels. Dataset days are stored in UTC.' }, h('input', { className: inputClass, value: settings.timezone, onChange: (e) => update({ timezone: e.target.value }), onBlur: () => toast('Timezone saved') }))
    );
  }

  if (mode === 'personal' && personalSection === 'appearance') {
    content = h('div', { className: 'grid gap-[var(--gap-grid)]' },
      h(Card, { title: 'Appearance', subtitle: 'How the workspace looks on this device. These preferences are stored locally and never leave the browser.' },
        h(Row, { label: 'Theme' }, h(Segmented, { ariaLabel: 'Theme', value: settings.theme, onChange: (v) => saveSettings({ theme: v }), options: [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }] })),
        h(Row, { label: 'Density', hint: 'Compact reduces card padding and table row height so more analysis fits on screen.' }, h(Segmented, { ariaLabel: 'Density', value: settings.density, onChange: (v) => saveSettings({ density: v }), options: [{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }] }))
      ),
      h(Card, { title: 'Accessibility', subtitle: 'Contrast, text size and motion. Reduced-motion is also honoured automatically from your operating system.' },
        h(Row, { label: 'High contrast', hint: 'Strengthens borders and secondary text for low-vision and bright-screen conditions.' }, h(Switch, { checked: settings.highContrast, label: 'High contrast', onChange: (v) => saveSettings({ highContrast: v }) })),
        h(Row, { label: 'Text scale', hint: 'Scales the whole interface, not just body copy, so layouts stay aligned.' }, h(Segmented, { ariaLabel: 'Text scale', value: settings.fontScale, onChange: (v) => saveSettings({ fontScale: v }), options: ['100','110','120'].map((v) => ({ id: v, label: `${v}%` })) })),
        h(Row, { label: 'Chart animations', hint: 'Turn off to remove chart motion. System-level reduced-motion always wins over this setting.' }, h(Switch, { checked: settings.chartAnimations, label: 'Chart animations', onChange: (v) => saveSettings({ chartAnimations: v }) }))
      )
    );
  }

  if (mode === 'personal' && personalSection === 'defaults') {
    content = h(Card, { title: 'Dashboard defaults', subtitle: 'The page, period and comparison the workspace opens with. Filters shared through a URL always take priority over these defaults.' },
      h(Row, { label: 'Default landing page' }, h('select', { className: inputClass, value: settings.defaultPage, onChange: (e) => saveSettings({ defaultPage: e.target.value }) }, [['/','Executive Overview'],['/global','Global Digital Performance'],['/web','Web Performance'],['/social','Social Media'],['/advocacy','Employee Advocacy'],['/content','Content Performance'],['/seo','SEO & Search'],['/ai-search','AI Search & AEO'],['/campaigns','Campaigns'],['/journey','Conversion Journey'],['/audience','Audience & Markets'],['/insights','Insights & Recommendations']].map(([v,l]) => h('option', { key: v, value: v }, l)))),
      h(Row, { label: 'Default date range' }, h('select', { className: inputClass, value: settings.defaultRange, onChange: (e) => saveSettings({ defaultRange: e.target.value }) }, [['7d','Last 7 days'],['28d','Last 28 days'],['30d','Last 30 days'],['90d','Last 90 days']].map(([v,l]) => h('option', { key: v, value: v }, l)))),
      h(Row, { label: 'Default comparison' }, h('select', { className: inputClass, value: settings.defaultCompare, onChange: (e) => saveSettings({ defaultCompare: e.target.value }) }, [['previous','Previous period'],['previous-month','Previous month'],['previous-quarter','Previous quarter'],['previous-year','Previous-year period'],['same-period-last-year','Same period last year'],['none','No comparison']].map(([v,l]) => h('option', { key: v, value: v }, l))))
    );
  }

  if (mode === 'personal' && personalSection === 'notifications') {
    content = h(Card, { title: 'Personal notifications', subtitle: 'Choose which operational notifications are visible to you.' },
      h(Row, { label: 'KPI anomaly alerts' }, h(Switch, { checked: settings.notifAnomalies, label: 'KPI anomaly alerts', onChange: (v) => saveSettings({ notifAnomalies: v }) })),
      h(Row, { label: 'Data-source health alerts' }, h(Switch, { checked: settings.notifSources, label: 'Data source alerts', onChange: (v) => saveSettings({ notifSources: v }) })),
      h(Row, { label: 'Scheduled report notifications' }, h(Switch, { checked: settings.notifReports, label: 'Report notifications', onChange: (v) => saveSettings({ notifReports: v }) })),
      h(Row, { label: 'Weekly digest' }, h(Switch, { checked: settings.notifDigest, label: 'Weekly digest', onChange: (v) => saveSettings({ notifDigest: v }) }))
    );
  }

  if (mode === 'personal' && personalSection === 'exports') {
    content = h(Card, { title: 'Personal export defaults', subtitle: 'Defaults used when creating reports and extracts.' },
      h(Row, { label: 'Preferred format' }, h('select', { className: inputClass, value: settings.exportFormat, onChange: (e) => saveSettings({ exportFormat: e.target.value }) }, ['pdf','xlsx','csv'].map((v) => h('option', { key: v, value: v }, v.toUpperCase())))),
      h(Row, { label: 'Include methodology' }, h(Switch, { checked: settings.exportMethodology, label: 'Include methodology', onChange: (v) => saveSettings({ exportMethodology: v }) })),
      h(Row, { label: 'Include comparison period' }, h(Switch, { checked: settings.exportComparison, label: 'Include comparison', onChange: (v) => saveSettings({ exportComparison: v }) }))
    );
  }

  if (mode === 'personal' && personalSection === 'session') {
    content = h('div', { className: 'grid gap-[var(--gap-grid)]' },
      h(Card, { title: 'Current session', subtitle: 'How you are signed in right now, and what this browser is storing.' },
        h('div', { className: 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4' },
          h(Stat, { label: 'Signed in as', value: user?.name || settings.profileName }),
          h(Stat, { label: 'Authentication', value: String(user?.provider || 'prototype-login') }),
          h(Stat, { label: 'Session started', value: sessionStarted }),
          h(Stat, { label: 'Inactivity lock', value: `${config.security.inactivityLockMinutes} min` })
        ),
        h('div', { className: 'mt-4' },
          h(Row, { label: 'Session timeout', hint: 'Personal preference. The organisation-wide maximum is set in the Back Office.' }, h('select', { className: inputClass, value: settings.sessionTimeoutMinutes, onChange: (e) => saveSettings({ sessionTimeoutMinutes: e.target.value }) }, ['15','30','60','120'].map((v) => h('option', { key: v, value: v }, `${v} min`)))),
          h(Row, { label: 'Veolia SSO availability' }, h(Badge, { tone: config.security.ssoEnabled ? 'pos' : 'warn' }, config.security.ssoEnabled ? 'ENABLED' : 'DISABLED')),
          h(Row, { label: 'MFA organisation policy' }, h(Badge, { tone: config.security.requireMfa ? 'pos' : 'warn' }, config.security.requireMfa ? 'REQUIRED' : 'OPTIONAL')),
          h(Row, { label: 'Allowed email domains' }, h('span', { className: 'text-[12px] text-t2' }, config.security.allowedDomains || '—'))
        )
      ),
      h(Card, { title: 'Local storage used by this workspace', subtitle: 'Everything below stays in this browser. No analytical data is transmitted anywhere by the prototype.' },
        h('div', { className: 'grid gap-2' },
          [
            ['Preferences', 'Theme, density, accessibility, language and dashboard defaults'],
            ['Saved analyses', 'Named page + period + filter combinations'],
            ['Recommendation statuses', 'New / accepted / in progress / completed / dismissed'],
            ['Back Office configuration', 'Prototype workspace, KPI targets, users and governance settings'],
            ['Read notifications', 'Which signals you have already seen']
          ].map(([label, detail]) => h('div', { key: label, className: 'flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-brd bg-card2 px-3 py-2.5' },
            h('div', { className: 'min-w-0' },
              h('div', { className: 'text-[12px] font-semibold text-t1' }, label),
              h('div', { className: 'mt-0.5 text-[10.5px] text-t3' }, detail)),
            h(Badge, { tone: 'neutral' }, 'THIS BROWSER')))
        ),
        h('div', { className: 'mt-4 flex flex-wrap gap-2' },
          h(Btn, { variant: 'ghost', onClick: () => openAdmin('security') }, 'Open Back Office security'),
          h(Btn, { variant: 'primary', onClick: signOut }, 'Sign out')
        )
      )
    );
  }

  if (mode === 'admin' && adminSection === 'overview') {
    content = h('div', { className: 'grid gap-[var(--gap-grid)]' },
      h(Card, null,
        h(SectionHeader, { title: 'Back Office system overview', description: 'A single place to govern workspace behaviour, users, data sources, targets, security, reporting and compliance.' }),
        h('div', { className: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4' },
          h(Stat, { label: 'Active users', value: String(activeUsers), tone: 'pos' }),
          h(Stat, { label: 'Healthy sources', value: `${healthyIntegrations}/${activeIntegrations}`, tone: healthyIntegrations === activeIntegrations ? 'pos' : 'warn' }),
          h(Stat, { label: 'Enabled KPIs', value: String(enabledKpis), tone: 'pos' }),
          h(Stat, { label: 'Environment', value: config.workspace.environment })
        )
      ),
      h(Card, { title: 'Administration checklist', subtitle: 'Configuration areas that should be validated before a production deployment.' },
        [['Identity & SSO', config.security.ssoEnabled], ['MFA policy', config.security.requireMfa], ['PII masking', config.security.piiMasking], ['Public sharing blocked', config.security.blockPublicSharing], ['Export watermark', config.security.exportWatermark], ['Anomaly detection', config.data.anomalyDetection]].map(([label, enabled]) => h('div', { key: label, className: 'flex items-center justify-between border-b border-brd py-3 last:border-0' }, h('span', { className: 'text-[11.5px] font-medium text-t1' }, label), h(Badge, { tone: enabled ? 'pos' : 'warn' }, enabled ? 'ENABLED' : 'REVIEW')))
      )
    );
  }

  if (mode === 'admin' && adminSection === 'workspace') {
    content = h(Card, { title: 'Workspace & localisation', subtitle: 'Product identity and organisation-wide defaults.' },
      h(Row, { label: 'Workspace name' }, h('input', { className: inputClass, value: config.workspace.name, onChange: (e) => patchSection('workspace', { name: e.target.value }) })),
      h(Row, { label: 'Organisation' }, h('input', { className: inputClass, value: config.workspace.organisation, onChange: (e) => patchSection('workspace', { organisation: e.target.value }) })),
      h(Row, { label: 'Environment label' }, h('input', { className: inputClass, value: config.workspace.environment, onChange: (e) => patchSection('workspace', { environment: e.target.value }) })),
      h(Row, { label: 'Product owner' }, h('input', { className: inputClass, value: config.workspace.owner, onChange: (e) => patchSection('workspace', { owner: e.target.value }) })),
      h(Row, { label: 'Support email' }, h('input', { className: inputClass, value: config.workspace.supportEmail, onChange: (e) => patchSection('workspace', { supportEmail: e.target.value }) })),
      h(Row, { label: 'Default language' }, h('select', { className: inputClass, value: config.workspace.defaultLanguage, onChange: (e) => patchSection('workspace', { defaultLanguage: e.target.value }) }, h('option', { value: 'fr' }, 'Français'), h('option', { value: 'en' }, 'English'))),
      h(Row, { label: 'Timezone' }, h('input', { className: inputClass, value: config.workspace.timezone, onChange: (e) => patchSection('workspace', { timezone: e.target.value }) })),
      h(Row, { label: 'Currency' }, h('select', { className: inputClass, value: config.workspace.currency, onChange: (e) => patchSection('workspace', { currency: e.target.value }) }, ['EUR','USD','GBP'].map((v) => h('option', { key: v, value: v }, v)))),
      h(Row, { label: 'Week starts on' }, h('select', { className: inputClass, value: config.workspace.weekStartsOn, onChange: (e) => patchSection('workspace', { weekStartsOn: e.target.value }) }, h('option', { value: 'monday' }, 'Monday'), h('option', { value: 'sunday' }, 'Sunday')))
    );
  }

  if (mode === 'admin' && adminSection === 'users') {
    const columns = [
      { id: 'name', label: 'User' }, { id: 'email', label: 'Email' },
      { id: 'role', label: 'Role', render: (row) => h('select', { className: 'h-8 rounded-[5px] border border-brd bg-card px-2 text-[10.5px]', value: row.role, onChange: (e) => updateArrayItem('users', row.id, { role: e.target.value }) }, config.roles.map((r) => h('option', { key: r.id, value: r.id }, r.label))) },
      { id: 'scope', label: 'Scope' },
      { id: 'status', label: 'Status', render: (row) => h(Badge, { tone: row.status === 'active' ? 'pos' : 'warn' }, row.status.toUpperCase()) },
      { id: 'action', label: 'Action', render: (row) => h(Btn, { size: 'sm', variant: 'ghost', onClick: () => removeArrayItem('users', row.id) }, 'Remove') }
    ];
    content = h(Card, { title: 'Users', subtitle: 'Prototype directory for access governance. Production access should be driven by Veolia identity and group membership.', right: h(Btn, { size: 'sm', onClick: () => updateConfig((prev) => ({ ...prev, users: [...prev.users, { id: `u${Date.now()}`, name: 'New user', email: 'new.user@veolia.example', role: 'Viewer', scope: 'Global', status: 'invited' }] })) }, 'Invite user') }, h(SimpleTable, { columns, rows: config.users }));
  }

  if (mode === 'admin' && adminSection === 'roles') {
    const permissions = ['view','export','reports','kpis','integrations','users','security','audit','settings'];
    content = h('div', { className: 'grid gap-3' }, config.roles.map((role) => h(Card, { key: role.id, title: role.label, subtitle: `${role.permissions.length} permissions` },
      h('div', { className: 'flex flex-wrap gap-2' }, permissions.map((permission) => {
        const enabled = role.permissions.includes(permission);
        return h('button', { key: permission, type: 'button', onClick: () => updateArrayItem('roles', role.id, { permissions: enabled ? role.permissions.filter((p) => p !== permission) : [...role.permissions, permission] }), className: `rounded-[5px] border px-2.5 py-1.5 text-[10px] font-semibold ${enabled ? 'border-[#b8dec9] bg-[#e9f7ef] text-[#00613b]' : 'border-brd bg-card2 text-t3'}` }, permission);
      }))
    )));
  }

  if (mode === 'admin' && adminSection === 'integrations') {
    const columns = [
      { id: 'name', label: 'Source' },
      { id: 'status', label: 'Status', render: (row) => h(Badge, { tone: row.health >= 90 ? 'pos' : row.health >= 75 ? 'warn' : 'neg' }, String(row.status).toUpperCase()) },
      { id: 'frequency', label: 'Sync frequency' },
      { id: 'health', label: 'Health', render: (row) => `${row.health}%` },
      { id: 'enabled', label: 'Enabled', render: (row) => h(Switch, { checked: row.enabled, label: `Enable ${row.name}`, onChange: (v) => updateArrayItem('integrations', row.id, { enabled: v }) }) },
      { id: 'sync', label: 'Action', render: (row) => h(Btn, { size: 'sm', onClick: () => { updateArrayItem('integrations', row.id, { status: 'connected', health: Math.max(row.health, 95) }); toast(`${row.name} sync completed`); } }, h(RefreshCw, { size: 11 }), 'Sync now') }
    ];
    content = h(Card, { title: 'Data sources & integrations', subtitle: 'Connector health, activation and refresh cadence.' }, h(SimpleTable, { columns, rows: config.integrations }));
  }

  if (mode === 'admin' && adminSection === 'kpis') {
    const columns = [
      { id: 'name', label: 'KPI' },
      { id: 'owner', label: 'Owner' },
      { id: 'targetType', label: 'Rule' },
      { id: 'target', label: 'Target', render: (row) => h('div', { className: 'flex items-center gap-1' }, h('input', { type: 'number', step: '0.1', className: 'h-8 w-20 rounded-[5px] border border-brd bg-card px-2 text-[10.5px]', value: row.target, onChange: (e) => updateArrayItem('kpis', row.id, { target: Number(e.target.value) }) }), h('span', null, row.unit)) },
      { id: 'enabled', label: 'Enabled', render: (row) => h(Switch, { checked: row.enabled, label: `Enable ${row.name}`, onChange: (v) => updateArrayItem('kpis', row.id, { enabled: v }) }) },
      { id: 'alert', label: 'Alert', render: (row) => h(Switch, { checked: row.alert, label: `Alert ${row.name}`, onChange: (v) => updateArrayItem('kpis', row.id, { alert: v }) }) }
    ];
    content = h(Card, { title: 'KPIs, targets & governance', subtitle: 'These targets feed the Executive Overview. Lower-is-better metrics such as CPA use a maximum target rule.' }, h(SimpleTable, { columns, rows: config.kpis }));
  }

  if (mode === 'admin' && adminSection === 'taxonomy') {
    const taxonomyEditor = (key, label) => h(Row, { key, label, hint: 'Comma-separated values used by governance and future source mapping.' }, h('textarea', { className: 'min-h-[76px] w-[440px] max-w-[70vw] rounded-[6px] border border-brd bg-card p-3 text-[11px] text-t1', value: config.taxonomy[key].join(', '), onChange: (e) => patchTaxonomy(key, e.target.value.split(',').map((x) => x.trim()).filter(Boolean)) }));
    content = h(Card, { title: 'Taxonomy', subtitle: 'Govern the classification used across filters, content, campaigns and reporting.' }, ['markets','themes','contentTypes','channels'].map((key) => taxonomyEditor(key, key === 'contentTypes' ? 'Content types' : key[0].toUpperCase() + key.slice(1))));
  }

  if (mode === 'admin' && adminSection === 'security') {
    const securityRows = [
      ['Veolia SSO', 'ssoEnabled', 'Show the Veolia SSO entry point on login.'],
      ['Prototype password login', 'passwordLoginEnabled', 'Keep the demo username/password login available.'],
      ['Require MFA', 'requireMfa', 'Production policy indicator for multi-factor authentication.'],
      ['PII masking', 'piiMasking', 'Mask personal identifiers in analytical views and exports.'],
      ['Block public sharing', 'blockPublicSharing', 'Prevent public-link sharing in production.'],
      ['Export watermark', 'exportWatermark', 'Apply classification watermarking to exports.'],
      ['Restrict exports', 'restrictExports', 'Allow export access only for approved roles.'],
      ['Admin approval for sensitive changes', 'requireAdminApproval', 'Require a second administrator for sensitive governance changes.'],
      ['IP allowlist', 'ipAllowlistEnabled', 'Restrict access to approved network ranges when production infrastructure supports it.']
    ];
    content = h(Card, { title: 'Security & authentication', subtitle: 'Prototype controls mirror the categories expected in an enterprise back office. Real enforcement requires Veolia-approved identity and server infrastructure.' },
      securityRows.map(([label, key, hint]) => h(Row, { key, label, hint }, h(Switch, { checked: Boolean(config.security[key]), label, onChange: (v) => {
        if ((key === 'ssoEnabled' && !v && !config.security.passwordLoginEnabled) || (key === 'passwordLoginEnabled' && !v && !config.security.ssoEnabled)) {
          toast('At least one login method must remain enabled', 'error');
          return;
        }
        patchSection('security', { [key]: v });
      } }))),
      h(Row, { label: 'Allowed email domains' }, h('input', { className: inputClass, value: config.security.allowedDomains, onChange: (e) => patchSection('security', { allowedDomains: e.target.value }) })),
      h(Row, { label: 'Session timeout' }, h('select', { className: inputClass, value: config.security.sessionTimeoutMinutes, onChange: (e) => patchSection('security', { sessionTimeoutMinutes: Number(e.target.value) }) }, [15,30,60,120,240].map((v) => h('option', { key: v, value: v }, `${v} min`)))),
      h(Row, { label: 'Inactivity lock' }, h('select', { className: inputClass, value: config.security.inactivityLockMinutes, onChange: (e) => patchSection('security', { inactivityLockMinutes: Number(e.target.value) }) }, [5,10,15,30,60].map((v) => h('option', { key: v, value: v }, `${v} min`)))),
      config.security.ipAllowlistEnabled ? h(Row, { label: 'Allowed IP ranges' }, h('input', { className: inputClass, value: config.security.ipAllowlist, placeholder: '10.0.0.0/8, 192.168.0.0/16', onChange: (e) => patchSection('security', { ipAllowlist: e.target.value }) })) : null
    );
  }

  if (mode === 'admin' && adminSection === 'alerts') {
    const labels = { anomalies: 'KPI anomalies', dataSourceFailures: 'Data-source failures', targetMisses: 'Target misses', securityEvents: 'Security events', weeklyDigest: 'Weekly digest', reportDelivery: 'Report delivery' };
    content = h(Card, { title: 'Alerts & notifications', subtitle: 'Organisation-wide alert rules and management digest.' },
      Object.keys(labels).map((key) => h(Row, { key, label: labels[key] }, h(Switch, { checked: Boolean(config.notifications[key]), label: labels[key], onChange: (v) => patchSection('notifications', { [key]: v }) }))),
      h(Row, { label: 'Digest day' }, h('select', { className: inputClass, value: config.notifications.digestDay, onChange: (e) => patchSection('notifications', { digestDay: e.target.value }) }, ['monday','tuesday','wednesday','thursday','friday'].map((v) => h('option', { key: v, value: v }, v)))),
      h(Row, { label: 'Digest time' }, h('input', { type: 'time', className: inputClass, value: config.notifications.digestHour, onChange: (e) => patchSection('notifications', { digestHour: e.target.value }) }))
    );
  }

  if (mode === 'admin' && adminSection === 'reports') {
    content = h(Card, { title: 'Reports & exports', subtitle: 'Organisation defaults, scheduling and distribution safeguards.' },
      h(Row, { label: 'Default export format' }, h('select', { className: inputClass, value: config.reporting.defaultFormat, onChange: (e) => patchSection('reporting', { defaultFormat: e.target.value }) }, ['pdf','xlsx','csv'].map((v) => h('option', { key: v, value: v }, v.toUpperCase())))),
      [['includeMethodology','Include methodology'],['includeComparison','Include comparison period'],['includeDataQuality','Include data-quality section'],['scheduledReports','Enable scheduled reports'],['approvalRequired','Approval before distribution']].map(([key,label]) => h(Row, { key, label }, h(Switch, { checked: Boolean(config.reporting[key]), label, onChange: (v) => patchSection('reporting', { [key]: v }) }))),
      h(Row, { label: 'Maximum export rows' }, h('input', { type: 'number', min: 1000, className: inputClass, value: config.reporting.maxRows, onChange: (e) => patchSection('reporting', { maxRows: Number(e.target.value) }) }))
    );
  }

  if (mode === 'admin' && adminSection === 'data') {
    content = h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
      h(Card, { title: 'Data quality & freshness', subtitle: 'Operational thresholds used to judge source reliability.' },
        h(Row, { label: 'Refresh frequency' }, h('select', { className: inputClass, value: config.data.refreshFrequency, onChange: (e) => patchSection('data', { refreshFrequency: e.target.value }) }, ['15 min','hourly','3h','6h','daily'].map((v) => h('option', { key: v, value: v }, v)))),
        h(Row, { label: 'Freshness SLA (hours)' }, h('input', { type: 'number', className: smallInputClass, value: config.data.freshnessSlaHours, onChange: (e) => patchSection('data', { freshnessSlaHours: Number(e.target.value) }) })),
        h(Row, { label: 'Quality threshold (%)' }, h('input', { type: 'number', min: 0, max: 100, className: smallInputClass, value: config.data.qualityThreshold, onChange: (e) => patchSection('data', { qualityThreshold: Number(e.target.value) }) })),
        h(Row, { label: 'UTM coverage target (%)' }, h('input', { type: 'number', min: 0, max: 100, className: smallInputClass, value: config.data.utmCoverageTarget, onChange: (e) => patchSection('data', { utmCoverageTarget: Number(e.target.value) }) })),
        h(Row, { label: 'Anomaly detection' }, h(Switch, { checked: config.data.anomalyDetection, label: 'Anomaly detection', onChange: (v) => patchSection('data', { anomalyDetection: v }) })),
        h(Row, { label: 'Automatic retry' }, h(Switch, { checked: config.data.autoRetry, label: 'Automatic retry', onChange: (v) => patchSection('data', { autoRetry: v }) }))
      ),
      h(Card, { title: 'Privacy, retention & compliance', subtitle: 'Prototype governance controls. Production policy must be approved by the appropriate Veolia teams.' },
        h(Row, { label: 'Data retention' }, h('select', { className: inputClass, value: config.security.dataRetentionMonths, onChange: (e) => patchSection('security', { dataRetentionMonths: Number(e.target.value) }) }, [3,6,12,24,36,60].map((v) => h('option', { key: v, value: v }, `${v} months`)))),
        h(Row, { label: 'Audit log retention' }, h('select', { className: inputClass, value: config.security.auditRetentionMonths, onChange: (e) => patchSection('security', { auditRetentionMonths: Number(e.target.value) }) }, [6,12,24,36,60,84].map((v) => h('option', { key: v, value: v }, `${v} months`)))),
        h(Row, { label: 'PII masking' }, h(Switch, { checked: config.security.piiMasking, label: 'PII masking', onChange: (v) => patchSection('security', { piiMasking: v }) })),
        h(Row, { label: 'Block public sharing' }, h(Switch, { checked: config.security.blockPublicSharing, label: 'Block public sharing', onChange: (v) => patchSection('security', { blockPublicSharing: v }) }))
      )
    );
  }

  if (mode === 'admin' && adminSection === 'features') {
    content = h(Card, { title: 'Feature flags', subtitle: 'Enable or hide product capabilities without changing the navigation architecture.' }, config.flags.map((flag) => h(Row, { key: flag.id, label: flag.name }, h(Switch, { checked: flag.enabled, label: flag.name, onChange: (v) => updateArrayItem('flags', flag.id, { enabled: v }) }))));
  }

  if (mode === 'admin' && adminSection === 'api') {
    content = h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
      h(Card, { title: 'API access', subtitle: 'Prototype surface for future approved service integrations.' },
        h(Row, { label: 'Base URL' }, h('code', { className: 'rounded-[5px] bg-card2 px-2 py-1 text-[10.5px] text-acctext' }, 'https://api.digital-performance.veolia.example/v1')),
        h('div', { className: 'mt-4 flex flex-wrap gap-2' }, ['analytics:read','reports:read','reports:write','admin:read'].map((scope) => h(Badge, { key: scope }, scope))),
        h('div', { className: 'mt-4' }, h(Btn, { onClick: () => toast('Demo API key regenerated') }, 'Regenerate demo key'))
      ),
      h(Card, { title: 'Webhooks', subtitle: 'Outbound events prepared for workflow automation.' },
        ['kpi.anomaly','report.generated','datasource.failed','security.alert'].map((event) => h('div', { key: event, className: 'flex items-center justify-between border-b border-brd py-2.5 last:border-0' }, h('code', { className: 'text-[10.5px] text-acctext' }, event), h(Badge, { tone: 'pos' }, 'ENABLED'))),
        h('div', { className: 'mt-4' }, h(Btn, { onClick: () => toast('Test webhook sent') }, 'Send test'))
      )
    );
  }

  if (mode === 'admin' && adminSection === 'audit') {
    const columns = [{ id: 'time', label: 'Time' }, { id: 'user', label: 'User' }, { id: 'action', label: 'Action' }, { id: 'object', label: 'Object' }, { id: 'result', label: 'Result', render: (row) => h(Badge, { tone: row.result === 'Success' ? 'pos' : 'warn' }, row.result.toUpperCase()) }];
    content = h(Card, { title: 'Audit history', subtitle: 'Prototype audit trail showing the kind of governance log expected in production.' }, h(SimpleTable, { columns, rows: config.audit }));
  }

  const navItems = mode === 'personal' ? personalNav : adminNav;
  const activeId = mode === 'personal' ? personalSection : adminSection;

  return h('div', { className: 'page-shell flex flex-col gap-[var(--gap-grid)]' },
    h('section', { className: 'rounded-[9px] border border-brds bg-card p-5' },
      h('div', { className: 'flex flex-wrap items-start justify-between gap-4' },
        h('div', null, h('div', { className: 'text-[10px] font-bold uppercase tracking-[.08em] text-[#c90000]' }, 'Platform configuration'), h('h1', { className: 'm-0 mt-1 text-[22px] font-bold text-t1' }, 'Settings & Back Office'), h('p', { className: 'm-0 mt-1 max-w-3xl text-[11.5px] leading-5 text-t3' }, 'Personal preferences and enterprise administration are separated clearly, but managed from one configuration centre.')),
        h(Segmented, { ariaLabel: 'Settings mode', value: mode, onChange: (value) => value === 'personal' ? openPersonal(personalSection) : openAdmin(adminSection), options: [{ id: 'personal', label: 'My settings' }, { id: 'admin', label: 'Back Office & administration' }] })
      )
    ),
    h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[245px_minmax(0,1fr)]' },
      h('nav', { 'aria-label': mode === 'personal' ? 'My settings sections' : 'Back Office sections', className: 'self-start rounded-[8px] border border-brd bg-card p-2 xl:sticky xl:top-24' },
        h('div', { className: 'px-3 pb-2 pt-1.5 text-[9.5px] font-bold uppercase tracking-[.09em] text-t3' },
          mode === 'personal' ? 'My settings' : 'Back Office & administration'),
        navItems.map(([id, label, Icon]) => h('button', { key: id, type: 'button', 'aria-current': activeId === id ? 'page' : undefined, onClick: () => mode === 'personal' ? openPersonal(id) : openAdmin(id), className: `flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-left text-[11.5px] transition ${activeId === id ? 'bg-[#f2f1f9] font-semibold text-t1' : 'text-t2 hover:bg-hov hover:text-t1'}` }, h(Icon, { size: 15, className: activeId === id ? 'text-[#ee0000]' : 'text-t3' }), label)),
        mode === 'admin' ? h('div', { className: 'mt-2 border-t border-brd pt-2' }, h(Btn, { size: 'sm', variant: 'ghost', className: 'w-full', onClick: () => { resetConfig(); toast('Back Office reset to prototype defaults'); } }, 'Reset prototype configuration')) : null
      ),
      h('main', { className: 'min-w-0' }, content || h(Card, { title: 'Configuration' }, 'Select a settings section.'))
    )
  );
}
