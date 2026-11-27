/**
 * HTTP contract: the JSON shapes the backend API returns and accepts.
 *
 * These are not the shapes of any upstream data source. Adapters map their
 * source data into these types, so the client never learns where products
 * come from.
 *
 * The backend owns this contract in backend/src/contract.ts. This file is a copy. Change both
 * together. (Next step: publish an OpenAPI spec and generate the client types
 * from it; see DECISIONS.md.)
 */

export interface Category {
  /** URL-safe identifier, e.g. "mens-clothing". */
  slug: string;
  /** Display name, e.g. "men's clothing". */
  name: string;
}

export interface Rating {
  /** Average rating, 0 to 5. */
  rate: number;
  /** Number of ratings. */
  count: number;
}

export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  category: Category;
  rating: Rating;
  /** Same-origin URL served by the backend (never the upstream image URL). */
  imageUrl: string;
}

export interface ProductListResponse {
  products: Product[];
}

export interface CategoryListResponse {
  categories: Category[];
}

export interface CategoryProductsResponse {
  category: Category;
  /** Top-rated products in this category. */
  featured: Product[];
  /** The rest of the category, also ordered by rating. */
  others: Product[];
}

export interface SearchResponse {
  query: string;
  products: Product[];
}

export interface EnquiryRequest {
  productId: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
}

export interface EnquiryResponse {
  enquiryId: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Field-level validation messages, keyed by field name. */
    fields?: Record<string, string>;
  };
}
