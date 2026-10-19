/** Registered social accounts as maintained in Administration (catalogue values only as a fallback). */
import { SOCIAL_ACCOUNTS } from '@shared/catalog';
import type { DB } from '../db/client';
import { socialAccounts } from '../db/schema';

export interface RegisteredAccount {
  name: string;
  platform: string;
  language: string | null;
  /** metrics chosen in Administration → Social accounts; empty = all supported metrics */
  metrics: string[];
}

export async function registeredAccounts(db: DB): Promise<(key: string) => RegisteredAccount> {
  const rows = new Map((await db.select().from(socialAccounts)).map((a) => [a.key, a]));
  return (key) => {
    const r = rows.get(key);
    const def = SOCIAL_ACCOUNTS.find((a) => a.id === key);
    return { name: r?.name ?? def?.name ?? key, platform: r?.platform ?? def?.platform ?? 'unknown', language: r?.language ?? def?.language ?? null, metrics: r?.metrics ?? [] };
  };
}
