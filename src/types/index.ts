/** Dimension identifiers */
export type MarketId = 'fr' | 'de' | 'uk' | 'us' | 'es' | 'pl';
export type ChannelId = 'organic' | 'direct' | 'referral' | 'social' | 'email' | 'paid';
export type PlatformId = 'linkedin' | 'youtube' | 'x' | 'instagram';
export type DeviceId = 'mobile' | 'desktop' | 'tablet';
export type ThemeId = 'sustainability' | 'innovation' | 'careers' | 'product' | 'thought-leadership' | 'community';
export type FormatId = 'video' | 'carousel' | 'image' | 'article' | 'document' | 'text';
export type LangId = 'en' | 'fr' | 'de' | 'es' | 'pl';

/** Daily web analytics fact — the atomic unit for all web aggregates.
 *  Invariants (enforced by generator, asserted by tests):
 *  users <= sessions, newUsers <= users, engaged <= sessions,
 *  conversions <= engaged. engTime is total engagement seconds. */
export interface WebFact {
  d: number;
  market: MarketId;
  channel: ChannelId;
  device: DeviceId;
  sessions: number;
  users: number;
  newUsers: number;
  engaged: number;
  conversions: number;
  engTime: number;
}

/** Daily social fact per platform x market.
 *  Invariants: reach <= impressions; reactions+comments+shares = engagements <= impressions;
 *  clicks <= impressions. */
export interface SocialFact {
  d: number;
  platform: PlatformId;
  market: MarketId;
  impressions: number;
  reach: number;
  reactions: number;
  comments: number;
  shares: number;
  clicks: number;
  videoViews: number;
  followerNet: number;
}

export type CampaignStatus = 'active' | 'completed' | 'paused' | 'planned';

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  /** inclusive day-index range within the dataset window */
  startD: number;
  endD: number;
  theme: ThemeId;
  markets: MarketId[];
  /** target cost per acquisition in EUR — used for performance vs target */
  targetCpa: number;
  owner: string;
}

/** Daily campaign delivery fact. Campaign traffic is a subset of the Paid
 *  channel (documented attribution rule). Invariants: clicks <= impressions,
 *  sessions <= clicks, conversions <= sessions. Spend in EUR. */
export interface CampaignFact {
  d: number;
  campaign: string;
  impressions: number;
  clicks: number;
  sessions: number;
  conversions: number;
  spend: number;
}

/** A published content item with lifetime totals.
 *  Invariants: engagements <= impressions, clicks <= impressions,
 *  conversions <= clicks. */
export interface ContentItem {
  id: string;
  title: string;
  titleFr: string;
  platform: PlatformId;
  theme: ThemeId;
  format: FormatId;
  market: MarketId;
  lang: LangId;
  publishD: number;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  clicks: number;
  conversions: number;
}

/** Daily landing-page fact (segmented by market only — channel/device splits
 *  are not collected for pages; the UI states this). */
export interface PageFact {
  d: number;
  page: string;
  market: MarketId;
  sessions: number;
  users: number;
  engaged: number;
  conversions: number;
}

export interface LandingPage {
  path: string;
  group: 'home' | 'product' | 'solutions' | 'resources' | 'company' | 'conversion';
}

/** Global filter state shared across pages */
export interface Filters {
  /** day-index range, inclusive */
  from: number;
  to: number;
  rangePreset: '7d' | '28d' | '90d' | 'custom';
  compare: 'previous' | 'none';
  markets: MarketId[];
  channels: ChannelId[];
  platforms: PlatformId[];
  devices: DeviceId[];
  campaigns: string[];
  themes: ThemeId[];
  formats: FormatId[];
}

export interface SavedView {
  id: string;
  name: string;
  filters: Filters;
  createdAt: string;
}
