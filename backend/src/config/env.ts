import { z } from 'zod';

/**
 * All runtime configuration comes from environment variables (12-factor), so
 * the same image runs locally, in docker compose, and on AWS (ECS / App Runner
 * task definitions or SSM / Secrets Manager injected env).
 */

const boolFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Set when running behind a load balancer (e.g. ALB) so req.ip is the client IP. */
    TRUST_PROXY: boolFromString.default(false),

    PRODUCT_SOURCE: z.enum(['fakestore', 'fixture']).default('fakestore'),
    FAKESTORE_BASE_URL: z.url().default('https://fakestoreapi.com'),
    FAKESTORE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    FAKESTORE_IMAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    FAKESTORE_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(5 * 60 * 1000),

    FEATURED_COUNT: z.coerce.number().int().min(1).max(50).default(5),
    CATEGORY_FEATURED_COUNT: z.coerce.number().int().min(1).max(50).default(3),

    MAIL_PROVIDER: z.enum(['console', 'file', 'smtp']).default('file'),
    MAIL_FROM: z.email().default('catalogue@example.com'),
    SALES_INBOX: z.email().default('sales@example.com'),
    MAIL_OUTBOX_DIR: z.string().min(1).default('./outbox'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: boolFromString.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    ENQUIRY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_PROVIDER === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required when MAIL_PROVIDER=smtp',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Parses and validates env. Throws one readable error listing every bad variable. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Treat empty strings as unset so `FOO=` in .env falls back to the default.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  );
  const result = EnvSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
