import { z } from 'zod';
import type { ProductImage, ProductRecord } from '../domain/product.js';
import { UpstreamError, type ProductRepository } from './ProductRepository.js';

/** Shape of a Fake Store product. Validated so a bad upstream payload fails loudly here. */
const FakeStoreProductSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  image: z.url(),
  rating: z.object({ rate: z.number(), count: z.number().int() }),
});
const FakeStoreProductListSchema = z.array(FakeStoreProductSchema);

type FakeStoreProduct = z.infer<typeof FakeStoreProductSchema>;

export interface FakeStoreOptions {
  baseUrl: string;
  /** Timeout for JSON calls. */
  timeoutMs: number;
  /** Timeout for image downloads, which are ~300 KB and slower than JSON. */
  imageTimeoutMs: number;
  /** How long to reuse the product list. 0 disables caching. */
  cacheTtlMs: number;
  /** Injected for tests. Defaults to global fetch. */
  fetchFn?: typeof fetch;
  now?: () => number;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Reads products from https://fakestoreapi.com.
 *
 * Fake Store has no search or ranking endpoints and only ~20 products, so this
 * adapter fetches the full list once and caches it in memory for cacheTtlMs.
 * A multi-instance deployment would move the cache to Redis / ElastiCache or
 * put a CDN in front; see DECISIONS.md.
 */
export class FakeStoreProductRepository implements ProductRepository {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly allowedImageHost: string;
  private cache: { expiresAt: number; products: ProductRecord[] } | null = null;
  private inflight: Promise<ProductRecord[]> | null = null;

  constructor(private readonly options: FakeStoreOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? Date.now;
    this.allowedImageHost = new URL(options.baseUrl).host;
  }

  async listAll(): Promise<ProductRecord[]> {
    if (this.cache && this.cache.expiresAt > this.now()) {
      return this.cache.products;
    }
    // Collapse concurrent cold-cache requests into one upstream call.
    this.inflight ??= this.fetchAll().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async getById(id: number): Promise<ProductRecord | null> {
    const products = await this.listAll();
    return products.find((p) => p.id === id) ?? null;
  }

  async getImage(id: number): Promise<ProductImage | null> {
    const product = await this.getById(id);
    if (!product) return null;

    // The URL came from upstream data, so pin it to the Fake Store host before
    // fetching. Without this the proxy could be pointed at arbitrary hosts.
    const url = new URL(product.sourceImageUrl);
    if (url.protocol !== 'https:' || url.host !== this.allowedImageHost) {
      throw new UpstreamError(`Refusing to proxy image from unexpected host ${url.host}`);
    }

    const res = await this.request(url.toString(), this.options.imageTimeoutMs);
    if (res.status === 404) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new UpstreamError(`Upstream image has unexpected content-type "${contentType}"`);
    }
    if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) {
      throw new UpstreamError('Upstream image exceeds size limit');
    }
    // The timeout signal also covers reading the body, so a slow download
    // rejects here. Map it like any other upstream failure (502, not 500).
    let data: Buffer;
    try {
      data = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      throw new UpstreamError(`Reading image body failed: ${url}`, { cause: err });
    }
    if (data.byteLength > MAX_IMAGE_BYTES) {
      throw new UpstreamError('Upstream image exceeds size limit');
    }
    return { contentType, data };
  }

  private async fetchAll(): Promise<ProductRecord[]> {
    const res = await this.request(new URL('/products', this.options.baseUrl).toString());
    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      throw new UpstreamError('Fake Store returned invalid JSON', { cause: err });
    }
    const parsed = FakeStoreProductListSchema.safeParse(body);
    if (!parsed.success) {
      throw new UpstreamError('Fake Store returned an unexpected payload', { cause: parsed.error });
    }
    const products = parsed.data.map(toRecord);
    if (this.options.cacheTtlMs > 0) {
      this.cache = { products, expiresAt: this.now() + this.options.cacheTtlMs };
    }
    return products;
  }

  private async request(url: string, timeoutMs = this.options.timeoutMs): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new UpstreamError(`Request to Fake Store failed: ${url}`, { cause: err });
    }
    if (!res.ok && res.status !== 404) {
      throw new UpstreamError(`Fake Store responded ${res.status} for ${url}`);
    }
    return res;
  }
}

function toRecord(p: FakeStoreProduct): ProductRecord {
  return {
    id: p.id,
    title: p.title.trim(),
    description: p.description.trim(),
    price: p.price,
    category: p.category,
    rating: { rate: p.rating.rate, count: p.rating.count },
    sourceImageUrl: p.image,
  };
}
