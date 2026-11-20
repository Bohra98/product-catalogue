import { readFileSync } from 'node:fs';
import type { ProductImage, ProductRecord } from '../domain/product.js';
import type { ProductRepository } from './ProductRepository.js';

interface FixtureProduct {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: { rate: number; count: number };
}

/**
 * In-memory products. Used by tests and for offline runs (PRODUCT_SOURCE=fixture).
 *
 * The default data is a snapshot of Fake Store's /products, so behaviour matches
 * the live adapter. Images are generated SVG placeholders so offline mode never
 * touches the network.
 */
export class FixtureProductRepository implements ProductRepository {
  private readonly products: ProductRecord[];

  constructor(products?: ProductRecord[]) {
    this.products = products ?? loadDefaultFixture();
  }

  async listAll(): Promise<ProductRecord[]> {
    return this.products;
  }

  async getById(id: number): Promise<ProductRecord | null> {
    return this.products.find((p) => p.id === id) ?? null;
  }

  async getImage(id: number): Promise<ProductImage | null> {
    const product = await this.getById(id);
    if (!product) return null;
    return { contentType: 'image/svg+xml', data: Buffer.from(placeholderSvg(product.title)) };
  }
}

function loadDefaultFixture(): ProductRecord[] {
  const url = new URL('./fixtures/products.json', import.meta.url);
  const raw = JSON.parse(readFileSync(url, 'utf8')) as FixtureProduct[];
  return raw.map((p) => ({
    id: p.id,
    title: p.title.trim(),
    description: p.description.trim(),
    price: p.price,
    category: p.category,
    rating: p.rating,
    sourceImageUrl: p.image,
  }));
}

function placeholderSvg(title: string): string {
  const initial = escapeXml(title.trim().charAt(0).toUpperCase() || '?');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#eef1f5"/><text x="50%" y="54%" text-anchor="middle" font-family="sans-serif" font-size="160" fill="#8a94a6">${initial}</text></svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}
