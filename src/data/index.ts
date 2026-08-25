import { generateDataset } from './generate';
import type { Dataset } from './generate';

/** Singleton, deterministic synthetic dataset. Generated once at module load. */
export const dataset: Dataset = generateDataset();

export { X_OUTAGE_DAYS, SOCIAL_TO_SESSION } from './generate';
export { CAMPAIGN_DEFS } from './campaigns';
export * from './dimensions';
