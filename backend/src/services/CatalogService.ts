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

/** Lowercased, whitespace-split search terms. Every term must match. */
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesQuery(product: ProductRecord, terms: string[]): boolean {
  const haystack = `${product.title}\n${product.description}\n${product.category}`.toLowerCase();
  return terms.every((t) => haystack.includes(t));
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
