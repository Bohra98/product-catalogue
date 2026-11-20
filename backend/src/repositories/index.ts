import type { Env } from '../config/env.js';
import { FakeStoreProductRepository } from './FakeStoreProductRepository.js';
import { FixtureProductRepository } from './FixtureProductRepository.js';
import type { ProductRepository } from './ProductRepository.js';

/** Composition root for the product data source. Add new adapters here. */
export function createProductRepository(env: Env): ProductRepository {
  switch (env.PRODUCT_SOURCE) {
    case 'fixture':
      return new FixtureProductRepository();
    case 'fakestore':
      return new FakeStoreProductRepository({
        baseUrl: env.FAKESTORE_BASE_URL,
        timeoutMs: env.FAKESTORE_TIMEOUT_MS,
        imageTimeoutMs: env.FAKESTORE_IMAGE_TIMEOUT_MS,
        cacheTtlMs: env.FAKESTORE_CACHE_TTL_MS,
      });
  }
}

export type { ProductRepository } from './ProductRepository.js';
export { UpstreamError } from './ProductRepository.js';
