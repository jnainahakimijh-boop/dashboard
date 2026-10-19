/** Physical table schemas shared by the demo engine, the warehouse loader, imports and connectors. */
import { ADS_MEASURES, GA4_ACQ_MEASURES, GA4_MEASURES, GA4_PAGE_MEASURES, GSC_MEASURES, SOCIAL_MEASURES } from '@shared/demo/generate';
import type { L10n } from '@shared/catalog';
import type { TableId } from '@shared/metrics';

export interface TableSchema {
  dims: string[];
  measures: readonly string[];
  gapDim?: string;
  label: L10n;
  source: string;
}

export const TABLE_SCHEMAS: Record<TableId, TableSchema> = {
  web: { dims: ['site', 'country', 'channel', 'device'], measures: GA4_MEASURES, gapDim: 'site', label: { en: 'GA4 — sessions by country, channel and device', fr: 'GA4 — sessions par pays, canal et appareil' }, source: 'ga4' },
  webacq: { dims: ['site', 'channel', 'srcmed', 'campaign'], measures: GA4_ACQ_MEASURES, gapDim: 'site', label: { en: 'GA4 — acquisition (source / medium, campaign)', fr: 'GA4 — acquisition (source / support, campagne)' }, source: 'ga4' },
  webpage: { dims: ['site', 'page'], measures: GA4_PAGE_MEASURES, gapDim: 'site', label: { en: 'GA4 — landing pages', fr: 'GA4 — pages de destination' }, source: 'ga4' },
  webbrowser: { dims: ['site', 'device', 'browser'], measures: ['sessions', 'engaged'], gapDim: 'site', label: { en: 'GA4 — browsers', fr: 'GA4 — navigateurs' }, source: 'ga4' },
  search: { dims: ['site', 'country', 'device'], measures: GSC_MEASURES, gapDim: 'site', label: { en: 'Search Console — property totals', fr: 'Search Console — totaux de la propriété' }, source: 'gsc' },
  searchquery: { dims: ['site', 'query'], measures: GSC_MEASURES, label: { en: 'Search Console — queries', fr: 'Search Console — requêtes' }, source: 'gsc' },
  searchpage: { dims: ['site', 'page'], measures: GSC_MEASURES, gapDim: 'site', label: { en: 'Search Console — pages', fr: 'Search Console — pages' }, source: 'gsc' },
  social: { dims: ['account'], measures: SOCIAL_MEASURES, gapDim: 'account', label: { en: 'Social accounts — daily', fr: 'Comptes sociaux — quotidien' }, source: 'social' },
  ads: { dims: ['ad'], measures: ADS_MEASURES, label: { en: 'ChatGPT Ads — daily by ad', fr: 'ChatGPT Ads — quotidien par annonce' }, source: 'chatgpt_ads' },
  forms: { dims: ['site', 'form'], measures: ['submissions'], gapDim: 'site', label: { en: 'Drupal webform submissions', fr: 'Soumissions de formulaires Drupal' }, source: 'drupal' },
};

export const TABLE_IDS = Object.keys(TABLE_SCHEMAS) as TableId[];

/** Day index 0 for warehouse tables (Uint16 day indices reach year 2194). */
export const WAREHOUSE_BASE = '2015-01-01';
