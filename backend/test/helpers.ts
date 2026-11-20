import type { ProductRecord } from '../src/domain/product.js';
import { createApp, type AppDeps } from '../src/http/app.js';
import { silentLogger } from '../src/logger.js';
import { InMemoryMailer } from '../src/mail/adapters.js';
import { FixtureProductRepository } from '../src/repositories/FixtureProductRepository.js';
import type { ProductRepository } from '../src/repositories/ProductRepository.js';

export function product(overrides: Partial<ProductRecord> & { id: number }): ProductRecord {
  return {
    title: `Product ${overrides.id}`,
    description: 'A product',
    price: 10,
    category: 'misc',
    rating: { rate: 3, count: 10 },
    sourceImageUrl: `https://fakestoreapi.com/img/${overrides.id}.png`,
    ...overrides,
  };
}

export function buildTestApp(
  options: { repo?: ProductRepository; config?: Partial<AppDeps['config']> } = {},
) {
  const mailer = new InMemoryMailer();
  const repo = options.repo ?? new FixtureProductRepository();
  const app = createApp({
    productRepository: repo,
    mailer,
    logger: silentLogger,
    config: {
      featuredCount: 5,
      categoryFeaturedCount: 3,
      salesInbox: 'sales@test.local',
      mailFrom: 'catalogue@test.local',
      enquiryRateLimitPerMinute: 100,
      trustProxy: false,
      ...options.config,
    },
  });
  return { app, mailer, repo };
}
