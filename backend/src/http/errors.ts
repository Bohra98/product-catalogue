import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '../contract.js';
import type { ZodError } from 'zod';
import { errorFields, type Logger } from '../logger.js';
import { MailDeliveryError } from '../mail/Mailer.js';
import { UpstreamError } from '../repositories/ProductRepository.js';
import { ProductNotFoundError } from '../services/EnquiryService.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);

export function validationError(error: ZodError): HttpError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return new HttpError(400, 'VALIDATION_ERROR', 'Request is invalid', fields);
}

export const unknownRoute: RequestHandler = (_req, _res, next) => {
  next(notFound('Route'));
};

/**
 * Maps domain and infrastructure errors to a stable JSON shape. Internal
 * details (stack traces, upstream URLs, SMTP errors) go to the log, never to
 * the client.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const httpError = toHttpError(err);
    if (httpError.status >= 500) {
      logger.error('http.error', { method: req.method, path: req.path, status: httpError.status, ...errorFields(err) });
    }
    const body: ApiErrorBody = {
      error: { code: httpError.code, message: httpError.message, fields: httpError.fields },
    };
    res.status(httpError.status).json(body);
  };
}

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof ProductNotFoundError) return notFound('Product');
  if (err instanceof UpstreamError) {
    return new HttpError(502, 'UPSTREAM_UNAVAILABLE', 'Product data is temporarily unavailable. Please try again.');
  }
  if (err instanceof MailDeliveryError) {
    return new HttpError(503, 'MAIL_UNAVAILABLE', 'We could not send your enquiry right now. Please try again.');
  }
  // body-parser errors carry a `type` and an HTTP status.
  if (isBodyParserError(err)) {
    if (err.type === 'entity.too.large') return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    return new HttpError(400, 'BAD_REQUEST', 'Request body is not valid JSON');
  }
  return new HttpError(500, 'INTERNAL', 'Something went wrong');
}

function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === 'object' && err !== null && 'type' in err && typeof (err as { type: unknown }).type === 'string'
    && 'status' in err && typeof (err as { status: unknown }).status === 'number' && (err as { status: number }).status < 500;
}
