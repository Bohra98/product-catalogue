import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from '../logger.js';
import { MailDeliveryError, type EmailMessage, type Mailer, type SendResult } from './Mailer.js';

/** Logs the email. Nothing leaves the process. */
export class ConsoleMailer implements Mailer {
  constructor(private readonly logger: Logger) {}

  async send(message: EmailMessage): Promise<SendResult> {
    const messageId = randomUUID();
    this.logger.info('mail.console', {
      messageId,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
    });
    return { messageId };
  }
}

/**
 * Writes each email as a real .eml file (RFC 5322, built by nodemailer) into a
 * local "outbox" directory. Open the file in any mail client to see exactly
 * what the sales inbox would receive. Default for local dev.
 */
export class FileMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    private readonly outboxDir: string,
    private readonly logger: Logger,
  ) {
    this.transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transport.sendMail(message);
      const id = randomUUID();
      const file = path.resolve(this.outboxDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${id}.eml`);
      await mkdir(this.outboxDir, { recursive: true });
      await writeFile(file, info.message as Buffer);
      this.logger.info('mail.file', { messageId: info.messageId, to: message.to, file });
      return { messageId: info.messageId ?? id };
    } catch (err) {
      throw new MailDeliveryError('Failed to write email to outbox', { cause: err });
    }
  }
}

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

/** Any SMTP server: Mailpit locally, Amazon SES SMTP endpoint in AWS. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(options: SmtpOptions, private readonly logger: Logger) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.pass ?? '' } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transport.sendMail(message);
      this.logger.info('mail.smtp', { messageId: info.messageId, to: message.to });
      return { messageId: info.messageId };
    } catch (err) {
      throw new MailDeliveryError('SMTP delivery failed', { cause: err });
    }
  }
}

/** Keeps sent messages in memory. For tests. */
export class InMemoryMailer implements Mailer {
  readonly sent: EmailMessage[] = [];
  failNext = false;

  async send(message: EmailMessage): Promise<SendResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new MailDeliveryError('Simulated failure');
    }
    this.sent.push(message);
    return { messageId: `mem-${this.sent.length}` };
  }
}
