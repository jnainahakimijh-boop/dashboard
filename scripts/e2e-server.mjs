// Starts the built server on a throw-away database for end-to-end tests.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const dir = mkdtempSync(join(tmpdir(), 'vdi-e2e-'));
const child = spawn(process.execPath, ['dist-server/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VDI_SKIP_DOTENV: '1',
    NODE_ENV: 'development',
    PORT: process.env.E2E_PORT ?? '8790',
    DATA_DIR: dir,
    DEMO_MODE: 'true',
    DEMO_LOGIN: 'true',
    JOBS_ENABLED: 'false',
    APP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    SEED_ADMIN_PASSWORD: 'E2e-Super-Admin-Passw0rd!',
    DEMO_USERS_PASSWORD: 'E2e-Demo-Passw0rd!',
    SMTP_HOST: '',
  },
});
const stop = () => {
  child.kill('SIGTERM');
  rmSync(dir, { recursive: true, force: true });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
