/** Hono application factory (shared by the server entry point and API tests). */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import { ZodError } from 'zod';
import { HttpError, clientIp, type AppContext, type HonoEnv } from './context';
import { csrfMiddleware, rateLimit, securityHeaders, sessionMiddleware } from './auth/middleware';
import { safeErrorMessage } from './security/redact';
import { systemEvent } from './audit';
import { authRoutes } from './routes/auth';
import { metaRoutes } from './routes/meta';
import { registerModuleRoutes } from './routes';

export function createApp(appCtx: AppContext, opts: { serveSpa?: boolean } = {}): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  app.use('*', async (c, next) => {
    c.set('app', appCtx);
    c.set('requestId', randomUUID());
    c.set('user', null);
    await next();
  });
  app.use('*', securityHeaders);

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: { message: err.message, code: err.code ?? 'error', details: err.details ?? null } }, err.status);
    }
    if (err instanceof ZodError) return c.json({ error: { message: 'Validation failed', code: 'validation', details: err.flatten() } }, 422);
    const status = (err as { status?: number }).status;
    if (status === 413) return c.json({ error: { message: 'Payload too large', code: 'too_large' } }, 413);
    void systemEvent(appCtx, 'error', 'api', `${c.req.method} ${c.req.path} failed`, { requestId: c.get('requestId'), error: safeErrorMessage(err) });
    appCtx.log.error('unhandled error', { path: c.req.path, method: c.req.method, requestId: c.get('requestId'), err: safeErrorMessage(err), stack: appCtx.env.isProduction ? undefined : (err as Error).stack?.split('\n').slice(0, 6).join(' | ') });
    return c.json({ error: { message: 'Internal server error', code: 'internal', requestId: c.get('requestId') } }, 500);
  });

  app.get('/api/health', async (c) => {
    let db = 'ok';
    try {
      await appCtx.db.execute('select 1' as never);
    } catch {
      db = 'error';
    }
    return c.json({ status: db === 'ok' ? 'ok' : 'degraded', db, uptimeSeconds: Math.round((Date.now() - appCtx.startedAt.getTime()) / 1000) }, db === 'ok' ? 200 : 503);
  });

  app.use('/api/*', async (c, next) => {
    const limit = c.req.path.startsWith('/api/admin/imports') ? 25 * 1024 * 1024 : c.req.path.startsWith('/api/admin/org') ? 2 * 1024 * 1024 : 1024 * 1024;
    return bodyLimit({ maxSize: limit, onError: () => { throw new HttpError(413, 'Payload too large', 'too_large'); } })(c, next);
  });
  app.use('/api/*', sessionMiddleware);
  app.use('/api/*', csrfMiddleware);
  app.use('/api/*', rateLimit('api', 1500, 60_000, (c) => c.get('user')?.id ?? clientIp(c)));

  app.route('/api/auth', authRoutes());
  app.route('/api', metaRoutes());
  registerModuleRoutes(app);

  app.all('/api/*', (c) => c.json({ error: { message: 'Not found', code: 'not_found' } }, 404));

  if (opts.serveSpa) {
    const root = resolve(process.cwd(), 'dist');
    const indexHtml = resolve(root, 'index.html');
    app.use('/assets/*', serveStatic({ root: './dist' }));
    app.use('/*', serveStatic({ root: './dist' }));
    app.get('*', (c) => (existsSync(indexHtml) ? c.html(readFileSync(indexHtml, 'utf8')) : c.text('Web app not built. Run `npm run build`.', 503)));
  }
  return app;
}
