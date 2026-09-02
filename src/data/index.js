import { generateDataset } from '/src/data/generate.js';
/** Singleton, deterministic synthetic dataset. Generated once at module load. */
export const dataset = generateDataset();
export { X_OUTAGE_DAYS, SOCIAL_TO_SESSION } from '/src/data/generate.js';
export { CAMPAIGN_DEFS } from '/src/data/campaigns.js';
export * from '/src/data/dimensions.js';
