import type {
  ApiErrorBody,
  CategoryListResponse,
  CategoryProductsResponse,
  EnquiryRequest,
  EnquiryResponse,
  Product,
  ProductListResponse,
  SearchResponse,
} from './types';

/**
 * The only place the UI talks to the network. Every call goes to our own
 * backend under same-origin /api; components never know (or care) where
 * products actually come from.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Something went wrong', err?.fields);
  }
  return body as T;
}

export const api = {
  getFeatured: () => request<ProductListResponse>('/products/featured').then((r) => r.products),

  getCategories: () => request<CategoryListResponse>('/categories').then((r) => r.categories),

  getCategoryProducts: (slug: string) =>
    request<CategoryProductsResponse>(`/categories/${encodeURIComponent(slug)}/products`),

  search: (query: string) =>
    request<SearchResponse>(`/products?${new URLSearchParams({ q: query })}`).then((r) => r.products),

  getProduct: (id: number) => request<Product>(`/products/${id}`),

  submitEnquiry: (enquiry: EnquiryRequest) =>
    request<EnquiryResponse>('/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enquiry),
    }),
};

export type Api = typeof api;
