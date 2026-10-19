/** Server entry point: API + built web app on one port. */
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { bootstrap, shutdown } from './bootstrap';

const app = await bootstrap();
const http = createApp(app, { serveSpa: app.env.isProduction || process.env.SERVE_SPA === 'true' });

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
