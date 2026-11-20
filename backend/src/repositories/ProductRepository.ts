import type { ProductImage, ProductRecord } from '../domain/product.js';

/**
 * The only seam between the app and wherever product data lives.
 *
 * Route handlers and services depend on this interface, never on an adapter.
 * Swapping Fake Store for a database, a PIM, or a search index means writing a
 * new class that implements it and changing one line in the composition root
 * (src/repositories/index.ts).
 *
 * The interface is deliberately small for the PoC: the catalogue is ~20 items,
 * so filtering and ranking happen in CatalogService. When a source is large
 * enough that this stops being reasonable, add query methods here
 * (e.g. findByCategory, search) and push the work down into the adapter.
 */
export interface ProductRepository {
  listAll(): Promise<ProductRecord[]>;
  getById(id: number): Promise<ProductRecord | null>;
  /** Image bytes for a product, or null if the product or image does not exist. */
  getImage(id: number): Promise<ProductImage | null>;
}

/** Thrown by adapters when the upstream source fails (timeout, 5xx, bad payload). */
export class UpstreamError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UpstreamError';
  }
}
