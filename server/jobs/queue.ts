/** ------------------------------------------------------------------
 *  PostgreSQL-backed job queue with retries, exponential back-off,
 *  stale-lock recovery and a scheduler for recurring work. Claims use
 *  SELECT … FOR UPDATE SKIP LOCKED so several server instances can
 *  share one database.
 *  ------------------------------------------------------------------ */
import { randomUUID } from 'node:crypto';
import { and, eq, lte, sql } from 'drizzle-orm';
import type { AppContext } from '../context';
import { jobs, reportSchedules, schedules } from '../db/schema';
import { safeErrorMessage } from '../security/redact';
import { nextRun, type Frequency } from './schedule';

export type JobRow = typeof jobs.$inferSelect;
export type JobHandler = (job: JobRow, app: AppContext) => Promise<Record<string, unknown> | void>;

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
  dedupeKey?: string;
  createdBy?: string | null;
}

export class JobQueue {
  private handlers = new Map<string, JobHandler>();
  private timer: NodeJS.Timeout | null = null;
  private schedTimer: NodeJS.Timeout | null = null;
  private running = 0;
  private stopped = true;
  readonly workerId = `worker-${randomUUID().slice(0, 8)}`;
  private app!: AppContext;

  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  types(): string[] {
    return [...this.handlers.keys()];
  }

  bind(app: AppContext): void {
    this.app = app;
  }

  async enqueue(type: string, payload: Record<string, unknown> = {}, opts: EnqueueOptions = {}): Promise<JobRow> {
    if (!this.handlers.has(type)) throw new Error(`Unknown job type: ${type}`);
    if (opts.dedupeKey) {
      const existing = await this.app.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.dedupeKey, opts.dedupeKey), sql`${jobs.status} in ('queued','running')`))
        .limit(1);
      if (existing[0]) return existing[0];
    }
    const [row] = await this.app.db
      .insert(jobs)
      .values({ type, payload, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 3, dedupeKey: opts.dedupeKey ?? null, createdBy: opts.createdBy ?? null })
      .returning();
    return row;
  }

  /** Claim and run at most one due job. Returns true if a job was processed. */
  async tick(): Promise<boolean> {
    const db = this.app.db;
    const claimed = await db.execute<Record<string, unknown>>(sql`
      UPDATE jobs SET status = 'running', locked_at = now(), locked_by = ${this.workerId}, attempts = attempts + 1
      WHERE id = (
        SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now()
        ORDER BY run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING id`);
    const rows = (claimed as unknown as { rows: Array<{ id: string }> }).rows ?? (claimed as unknown as Array<{ id: string }>);
    const id = rows?.[0]?.id;
    if (!id) return false;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    const handler = this.handlers.get(job.type);
    this.running++;
    try {
      if (!handler) throw new Error(`No handler for job type ${job.type}`);
      const result = await handler(job, this.app);
      await db.update(jobs).set({ status: 'succeeded', result: result ?? {}, finishedAt: new Date(), lastError: null }).where(eq(jobs.id, id));
    } catch (err) {
      const msg = safeErrorMessage(err);
      const retry = job.attempts < job.maxAttempts;
      const backoff = Math.min(3600, 30 * 2 ** (job.attempts - 1)) * 1000;
      await db
        .update(jobs)
        .set(retry ? { status: 'queued', runAt: new Date(Date.now() + backoff), lastError: msg, lockedAt: null, lockedBy: null } : { status: 'failed', lastError: msg, finishedAt: new Date() })
        .where(eq(jobs.id, id));
      this.app.log.warn('job failed', { type: job.type, id, attempt: job.attempts, retry, error: msg });
    } finally {
      this.running--;
    }
    return true;
  }

  /** Run due jobs until the queue is empty (used by tests and CLI). */
  async drain(max = 100): Promise<number> {
    let n = 0;
    while (n < max && (await this.tick())) n++;
    return n;
  }

  async recoverStale(): Promise<void> {
    await this.app.db
      .update(jobs)
      .set({ status: 'queued', lockedAt: null, lockedBy: null, lastError: 'Recovered after worker interruption' })
      .where(and(eq(jobs.status, 'running'), lte(jobs.lockedAt, new Date(Date.now() - 15 * 60_000))));
  }

  /** Enqueue jobs for due schedules and report schedules. */
  async schedulerTick(now = new Date()): Promise<number> {
    const db = this.app.db;
    let n = 0;
    const due = await db.select().from(schedules).where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, now)));
    for (const s of due) {
      if (this.handlers.has(s.jobType)) {
        await this.enqueue(s.jobType, { ...s.payload, scheduleId: s.id }, { dedupeKey: `schedule:${s.id}` });
        n++;
      }
      await db
        .update(schedules)
        .set({ lastRunAt: now, nextRunAt: nextRun(s.frequency as Frequency, now) })
        .where(eq(schedules.id, s.id));
    }
    const reports = await db.select().from(reportSchedules).where(and(eq(reportSchedules.enabled, true), lte(reportSchedules.nextRunAt, now)));
    for (const r of reports) {
      await this.enqueue('report.scheduled', { reportScheduleId: r.id }, { dedupeKey: `report-schedule:${r.id}` });
      await db
        .update(reportSchedules)
        .set({ lastRunAt: now, nextRunAt: nextRun(r.frequency as Frequency, now) })
        .where(eq(reportSchedules.id, r.id));
      n++;
    }
    return n;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const poll = this.app.env.JOBS_POLL_MS;
    const loop = async () => {
      if (this.stopped) return;
      try {
        while (!this.stopped && (await this.tick())) {
          /* keep draining */
        }
      } catch (err) {
        this.app.log.error('job loop error', { err: safeErrorMessage(err) });
      }
      if (!this.stopped) this.timer = setTimeout(loop, poll);
    };
    const sched = async () => {
      if (this.stopped) return;
      try {
        await this.recoverStale();
        await this.schedulerTick();
      } catch (err) {
        this.app.log.error('scheduler error', { err: safeErrorMessage(err) });
      }
      if (!this.stopped) this.schedTimer = setTimeout(sched, 30_000);
    };
    this.timer = setTimeout(loop, 500);
    this.schedTimer = setTimeout(sched, 1000);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.schedTimer) clearTimeout(this.schedTimer);
    for (let i = 0; i < 50 && this.running > 0; i++) await new Promise((r) => setTimeout(r, 100));
  }
}
