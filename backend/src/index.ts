import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './config/env.js';
import { createApp } from './http/app.js';
import { createLogger, errorFields } from './logger.js';
import { createMailer } from './mail/index.js';
import { createProductRepository } from './repositories/index.js';

// Local convenience: load backend/.env if present. In containers and on
// AWS, real environment variables are used and no file is needed.
const rootEnv = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const logger = createLogger();

let env;
try {
  env = loadEnv();
} catch (err) {
  logger.error('config.invalid', errorFields(err));
  process.exit(1);
}

const app = createApp({
  productRepository: createProductRepository(env),
  mailer: createMailer(env, logger),
  logger,
  config: {
    featuredCount: env.FEATURED_COUNT,
    categoryFeaturedCount: env.CATEGORY_FEATURED_COUNT,
    salesInbox: env.SALES_INBOX,
    mailFrom: env.MAIL_FROM,
    enquiryRateLimitPerMinute: env.ENQUIRY_RATE_LIMIT_PER_MINUTE,
    trustProxy: env.TRUST_PROXY,
  },
});

const server = app.listen(env.PORT, () => {
  logger.info('server.started', {
    port: env.PORT,
    productSource: env.PRODUCT_SOURCE,
    mailProvider: env.MAIL_PROVIDER,
  });
});

// ECS sends SIGTERM on deploy/scale-in; finish in-flight requests first.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info('server.stopping', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
