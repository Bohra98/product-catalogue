/**
 * Provider-neutral outgoing email. Plain text only for the PoC, which also
 * removes any HTML-injection risk from user-supplied enquiry content.
 */
export interface EmailMessage {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export interface SendResult {
  /** Provider message id when the provider gives one, otherwise our own id. */
  messageId: string;
}

/**
 * The only seam between enquiry handling and email delivery.
 *
 * Adapters: ConsoleMailer and FileMailer for zero-account local runs,
 * SmtpMailer for anything that speaks SMTP (Mailpit locally, Amazon SES SMTP
 * in AWS). A provider with its own HTTP API (SES v2 SDK, SendGrid, Postmark)
 * is one more class implementing this interface.
 */
export interface Mailer {
  send(message: EmailMessage): Promise<SendResult>;
}

export class MailDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MailDeliveryError';
  }
}
