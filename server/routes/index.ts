import type { Hono } from 'hono';
import { requireAuth } from '../auth/middleware';
import type { HonoEnv } from '../context';
import { adminRoutes } from './admin';
import { adsRoutes } from './ads';
import { contentRoutes } from './content';
import { geoRoutes } from './geo';
import { ingestRoutes } from './ingest';
import { insightsRoutes, notificationRoutes } from './insights';
import { personalRoutes } from './personal';
import { exportRoutes, reportRoutes } from './reports';
import { seoRoutes } from './seo';
import { socialRoutes } from './social';
import { webRoutes } from './web';

/** Registers every module router under /api. Each router enforces its own permissions server-side. */
export function registerModuleRoutes(app: Hono<HonoEnv>): void {
  app.route('/api/ingest', ingestRoutes());
  app.use('/api/notifications/*', requireAuth);
  app.use('/api/exports/*', requireAuth);
  app.route('/api/web', webRoutes());
  app.route('/api/social', socialRoutes());
  app.route('/api/seo', seoRoutes());
  app.route('/api/geo', geoRoutes());
  app.route('/api/ads', adsRoutes());
  app.route('/api/content', contentRoutes());
  app.route('/api/insights', insightsRoutes());
  app.route('/api/notifications', notificationRoutes());
  app.route('/api/reports', reportRoutes());
  app.route('/api/exports', exportRoutes());
  app.route('/api/me', personalRoutes());
  app.route('/api/admin', adminRoutes());
}
