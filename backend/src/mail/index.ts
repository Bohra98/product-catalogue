import type { Env } from '../config/env.js';
import type { Logger } from '../logger.js';
import { ConsoleMailer, FileMailer, SmtpMailer } from './adapters.js';
import type { Mailer } from './Mailer.js';

/** Composition root for email delivery. Add new providers here. */
export function createMailer(env: Env, logger: Logger): Mailer {
  switch (env.MAIL_PROVIDER) {
    case 'console':
      return new ConsoleMailer(logger);
    case 'file':
      return new FileMailer(env.MAIL_OUTBOX_DIR, logger);
    case 'smtp':
      return new SmtpMailer(
        {
          // env validation guarantees SMTP_HOST is set for this provider.
          host: env.SMTP_HOST as string,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        logger,
      );
  }
}

export type { Mailer, EmailMessage } from './Mailer.js';
