/** Server entry point: API + built web app on one port. */
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { bootstrap, shutdown } from './bootstrap';
import { ConfigError } from './env';

let app: Awaited<ReturnType<typeof bootstrap>>;
try {
  app = await bootstrap();
} catch (err) {
  if (err instanceof ConfigError) {
    // configuration problems are reported plainly (no stack trace, no secret values)
    console.error(`Configuration error: ${err.message} See .env.example and docs/SETUP.md.`);
    process.exit(1);
  }
  throw err;
}
// serves the built web app from dist/ unless disabled (the Vite dev server is used during development)
const http = createApp(app, { serveSpa: process.env.SERVE_SPA !== 'false' });

const server = serve({ fetch: http.fetch, port: app.env.PORT, hostname: process.env.HOST ?? '127.0.0.1' }, (info) => {
  app.log.info('server listening', { port: info.port, demoMode: app.env.DEMO_MODE, db: app.dbh.kind });
});

let closing = false;
async function stop(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info('shutting down', { signal });
  server.close();
  await shutdown(app);
  process.exit(0);
}
process.on('SIGINT', () => void stop('SIGINT'));
process.on('SIGTERM', () => void stop('SIGTERM'));
