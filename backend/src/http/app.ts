import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from '../logger.js';
import type { Mailer } from '../mail/Mailer.js';
import type { ProductRepository } from '../repositories/ProductRepository.js';
import { CatalogService } from '../services/CatalogService.js';
import { EnquiryService } from '../services/EnquiryService.js';
import { errorHandler, unknownRoute } from './errors.js';
import { rateLimit } from './rateLimit.js';
import { catalogRouter } from './routes/catalog.js';
import { enquiryRouter } from './routes/enquiries.js';

export interface AppDeps {
  productRepository: ProductRepository;
  mailer: Mailer;
  logger: Logger;
  config: {
    featuredCount: number;
    categoryFeaturedCount: number;
    salesInbox: string;
    mailFrom: string;
    enquiryRateLimitPerMinute: number;
    trustProxy: boolean;
  };
}

/**
 * Builds the Express app from injected dependencies. No env reads, no network
 * listeners: tests call this with fixtures and an in-memory mailer.
 */
export function createApp(deps: AppDeps): Express {
  const { config } = deps;
  const catalog = new CatalogService(deps.productRepository, {
    featuredCount: config.featuredCount,
    categoryFeaturedCount: config.categoryFeaturedCount,
  });
  const enquiries = new EnquiryService(deps.productRepository, deps.mailer, {
    salesInbox: config.salesInbox,
    from: config.mailFrom,
  });

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());

  // Liveness check for ALB / ECS / App Runner. Does not call upstream, so a
  // Fake Store outage does not get healthy tasks killed.
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = express.Router();
  api.use(express.json({ limit: '16kb' }));
  api.use(catalogRouter(catalog, deps.productRepository));
  api.use(
    enquiryRouter(enquiries, rateLimit({ limit: config.enquiryRateLimitPerMinute, windowMs: 60_000 })),
  );
  app.use('/api', api);

  app.use(unknownRoute);
  app.use(errorHandler(deps.logger));
  return app;
}
