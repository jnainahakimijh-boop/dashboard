/** Minimal structured logger. Payloads are redacted; credentials are never logged. */
import { redact } from './security/redact';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

export function createLogger(minLevel: Level = (process.env.LOG_LEVEL as Level) || 'info', silent = false): Logger {
  const emit = (level: Level, msg: string, data?: Record<string, unknown>) => {
    if (silent || ORDER[level] < ORDER[minLevel]) return;
    const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(data ? redact(data) : {}) });
    if (level === 'error' || level === 'warn') console.error(line);
    else console.log(line);
  };
  return {
    debug: (m, d) => emit('debug', m, d),
    info: (m, d) => emit('info', m, d),
    warn: (m, d) => emit('warn', m, d),
    error: (m, d) => emit('error', m, d),
  };
}
