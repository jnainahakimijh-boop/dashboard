// Creates a local .env from .env.example with freshly generated secrets.
// Never overwrites an existing .env.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
  console.log('.env already exists — leaving it untouched.');
  process.exit(0);
}

const password = () => randomBytes(12).toString('base64url');
const adminPassword = password();
const demoPassword = password();

const content = readFileSync('.env.example', 'utf8')
  .replace(/^APP_ENCRYPTION_KEY=.*$/m, `APP_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`)
  .replace(/^SEED_ADMIN_PASSWORD=.*$/m, `SEED_ADMIN_PASSWORD=${adminPassword}`)
  .replace(/^DEMO_USERS_PASSWORD=.*$/m, `DEMO_USERS_PASSWORD=${demoPassword}`);

writeFileSync('.env', content, { mode: 0o600 });
console.log('Created .env with generated secrets.');
console.log('Super administrator: admin@veolia.example — password stored in .env (SEED_ADMIN_PASSWORD).');
