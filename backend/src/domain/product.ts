/**
 * Internal product model. Repositories return this; the HTTP layer maps it to
 * the public DTO in @catalogue/shared. Keeping the two apart means an upstream
 * field rename only touches an adapter, and the upstream image URL never leaks
 * to the client.
 */
export interface ProductRecord {
  id: number;
  title: string;
  description: string;
  price: number;
  /** Category display name as the source knows it, e.g. "men's clothing". */
  category: string;
  rating: { rate: number; count: number };
  /** Upstream image location. Only the image proxy reads this. */
  sourceImageUrl: string;
}

export interface ProductImage {
  contentType: string;
  data: Buffer;
}

/** "men's clothing" -> "mens-clothing". Stable, URL-safe, reversible via lookup. */
export function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
