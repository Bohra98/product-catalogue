/**
 * Minimal structured logger: one JSON object per line on stdout/stderr, which
 * CloudWatch Logs (awslogs driver) and most log shippers parse as-is. Swap for
 * pino if the app grows; callers only depend on this interface.
 */
export interface Logger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createLogger(options: { silent?: boolean } = {}): Logger {
  const write = (level: string, event: string, data?: Record<string, unknown>) => {
    if (options.silent) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...data });
    if (level === 'error') console.error(line);
    else console.log(line);
  };
  return {
    info: (e, d) => write('info', e, d),
    warn: (e, d) => write('warn', e, d),
    error: (e, d) => write('error', e, d),
  };
}

export const silentLogger: Logger = createLogger({ silent: true });

/** Reduces an unknown error to loggable fields without dumping huge objects. */
export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      error: err.name,
      message: err.message,
      cause: err.cause instanceof Error ? err.cause.message : undefined,
    };
  }
  return { error: String(err) };
}
