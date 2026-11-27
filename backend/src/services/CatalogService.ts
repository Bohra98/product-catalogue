import type {
  Category,
  CategoryProductsResponse,
  Product,
} from '../contract.js';
import { categorySlug, type ProductRecord } from '../domain/product.js';
import type { ProductRepository } from '../repositories/ProductRepository.js';

export interface CatalogOptions {
  featuredCount: number;
  categoryFeaturedCount: number;
}

export const MAX_QUERY_LENGTH = 100;

/**
 * "Top rated" ordering. Fake Store has no curated featured list, so we rank by
 * average rating, then by number of ratings (a 4.8 from 400 people beats a 4.8
 * from 3), then by id so the order is stable. Swapping in a curated list later
 * means replacing this function or the featured methods below, not the routes.
 */
export function compareTopRated(a: ProductRecord, b: ProductRecord): number {
  return b.rating.rate - a.rating.rate || b.rating.count - a.rating.count || a.id - b.id;
}

/**
 * Splits text into normalised words. Used for both the query and the product
 * text, so both sides always agree:
 * - lowercased, accents removed ("Fjällräven" -> "fjallraven")
 * - apostrophes dropped, so "men's", "men’s" and "mens" are the same word
 * - any other non-letter/digit is a word break, so "T-Shirt" and "T Shirt" match
 */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’ʼ`]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Every term must be the start of some word in the product's title,
 * description or category. Prefix matching keeps plurals ("jacket" finds
 * "jackets") while stopping matches inside words ("men" must not find "women").
 * Each pair of neighbouring words is also tried joined, so "tshirt" finds
 * "T-Shirt" and "T Shirt"; a pair still starts at a word boundary.
 */
export function matchesQuery(product: ProductRecord, terms: string[]): boolean {
  const words = tokenize(`${product.title} ${product.description} ${product.category}`);
  const candidates = words.concat(words.slice(1).map((w, i) => words[i] + w));
  return terms.every((t) => candidates.some((w) => w.startsWith(t)));
}

export class CatalogService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly options: CatalogOptions,
  ) {}

  async getFeatured(): Promise<Product[]> {
    const products = await this.repo.listAll();
    return [...products].sort(compareTopRated).slice(0, this.options.featuredCount).map(toDto);
  }

  async getCategories(): Promise<Category[]> {
    const products = await this.repo.listAll();
    const byslug = new Map<string, Category>();
    for (const p of products) {
      const category = toCategory(p.category);
      if (!byslug.has(category.slug)) byslug.set(category.slug, category);
    }
    return [...byslug.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Returns null when no product belongs to the slug. */
  async getCategoryProducts(slug: string): Promise<CategoryProductsResponse | null> {
    const products = await this.repo.listAll();
    const inCategory = products
      .filter((p) => categorySlug(p.category) === slug)
      .sort(compareTopRated);
    const first = inCategory[0];
    if (!first) return null;

    const n = this.options.categoryFeaturedCount;
    return {
      category: toCategory(first.category),
      featured: inCategory.slice(0, n).map(toDto),
      others: inCategory.slice(n).map(toDto),
    };
  }

  /**
   * Case-insensitive match on title, description and category. Multi-word
   * queries must match every word (AND). Results use the top-rated order.
   * Callers validate the query; an empty term list returns no results.
   */
  async search(query: string): Promise<Product[]> {
    const terms = tokenize(query);
    if (terms.length === 0) return [];
    const products = await this.repo.listAll();
    return products
      .filter((p) => matchesQuery(p, terms))
      .sort(compareTopRated)
      .map(toDto);
  }

  async getProduct(id: number): Promise<Product | null> {
    const product = await this.repo.getById(id);
    return product ? toDto(product) : null;
  }
}

function toCategory(name: string): Category {
  return { slug: categorySlug(name), name };
}

export function toDto(p: ProductRecord): Product {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    category: toCategory(p.category),
    rating: { rate: p.rating.rate, count: p.rating.count },
    imageUrl: `/api/images/${p.id}`,
  };
}
