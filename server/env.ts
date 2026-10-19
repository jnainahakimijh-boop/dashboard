/** Validated runtime configuration. Secrets are read from the environment only. */
import { existsSync } from 'node:fs';
import { z } from 'zod';

if (existsSync('.env') && !process.env.VDI_SKIP_DOTENV) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* malformed .env is reported by the schema below */
  }
}

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional().default(''),
  DATA_DIR: z.string().default('./.data'),
  APP_ENCRYPTION_KEY: z.string().optional().default(''),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(60),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(24 * 7).default(12),
  DEMO_MODE: bool(true),
  DEMO_LOGIN: bool(true),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@veolia.example'),
  SEED_ADMIN_PASSWORD: z.string().optional().default(''),
  DEMO_USERS_PASSWORD: z.string().optional().default(''),
  JOBS_ENABLED: bool(true),
  JOBS_POLL_MS: z.coerce.number().int().min(250).max(60000).default(2000),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
  CRAWLER_USER_AGENT: z.string().default('VeoliaDigitalIntelligenceAudit/1.0 (+internal)'),
  /** comma-separated hosts the crawler may ever reach (in addition to per-scope approval); used by tests */
  CRAWLER_EXTRA_ALLOWED_HOSTS: z.string().optional().default(''),
  TRUST_PROXY: bool(false),
});

export type Env = z.infer<typeof schema> & { isProduction: boolean; demoLoginEnabled: boolean; encryptionKey: Buffer | null; smtpConfigured: boolean };

export class ConfigError extends Error {}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid configuration: ${issues}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  let encryptionKey: Buffer | null = null;
  if (e.APP_ENCRYPTION_KEY) {
    encryptionKey = Buffer.from(e.APP_ENCRYPTION_KEY, 'base64');
    if (encryptionKey.length !== 32) throw new ConfigError('APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded (run `npm run setup`).');
  } else if (isProduction) {
    throw new ConfigError('APP_ENCRYPTION_KEY is required in production.');
  }
  if (isProduction && !e.DATABASE_URL) throw new ConfigError('DATABASE_URL is required in production (embedded PGlite is for local and demo use).');
  return {
    ...e,
    isProduction,
    demoLoginEnabled: e.DEMO_LOGIN && !isProduction,
    encryptionKey,
    smtpConfigured: !!e.SMTP_HOST && !!e.SMTP_FROM,
  };
}
