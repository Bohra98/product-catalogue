import { Router } from 'express';
import { z } from 'zod';
import type {
  CategoryListResponse,
  CategoryProductsResponse,
  Product,
  ProductListResponse,
  SearchResponse,
} from '../../contract.js';
import type { CatalogService } from '../../services/CatalogService.js';
import { MAX_QUERY_LENGTH } from '../../services/CatalogService.js';
import type { ProductRepository } from '../../repositories/ProductRepository.js';
import { notFound, validationError } from '../errors.js';

export const IdParam = z.string().regex(/^\d{1,9}$/, 'Must be a positive integer').transform(Number);
const SlugParam = z.string().regex(/^[a-z0-9-]{1,64}$/, 'Invalid category');
const SearchQuery = z.object({
  q: z
    .string({ error: 'Enter a search term' })
    .trim()
    .min(1, 'Enter a search term')
    .max(MAX_QUERY_LENGTH, `Search term must be ${MAX_QUERY_LENGTH} characters or fewer`),
});

/** Short shared cache: catalogue data changes rarely, and this keeps upstream load low. */
const CATALOG_CACHE = 'public, max-age=60';

export function catalogRouter(catalog: CatalogService, repo: ProductRepository): Router {
  const router = Router();

  router.get('/products/featured', async (_req, res) => {
    const body: ProductListResponse = { products: await catalog.getFeatured() };
    res.set('Cache-Control', CATALOG_CACHE).json(body);
  });

  router.get('/products', async (req, res) => {
    const parsed = SearchQuery.safeParse(req.query);
    if (!parsed.success) throw validationError(parsed.error);
    const body: SearchResponse = { query: parsed.data.q, products: await catalog.search(parsed.data.q) };
    res.json(body);
  });

  router.get('/products/:id', async (req, res) => {
    const id = IdParam.safeParse(req.params.id);
    if (!id.success) throw notFound('Product');
    const product: Product | null = await catalog.getProduct(id.data);
    if (!product) throw notFound('Product');
    res.set('Cache-Control', CATALOG_CACHE).json(product);
  });

  router.get('/categories', async (_req, res) => {
    const body: CategoryListResponse = { categories: await catalog.getCategories() };
    res.set('Cache-Control', CATALOG_CACHE).json(body);
  });

  router.get('/categories/:slug/products', async (req, res) => {
    const slug = SlugParam.safeParse(req.params.slug);
    if (!slug.success) throw notFound('Category');
    const body: CategoryProductsResponse | null = await catalog.getCategoryProducts(slug.data);
    if (!body) throw notFound('Category');
    res.set('Cache-Control', CATALOG_CACHE).json(body);
  });

  /**
   * Image proxy. The browser only ever talks to our origin; the repository
   * decides where image bytes come from.
   */
  router.get('/images/:id', async (req, res) => {
    const id = IdParam.safeParse(req.params.id);
    if (!id.success) throw notFound('Image');
    const image = await repo.getImage(id.data);
    if (!image) throw notFound('Image');
    res
      .set('Content-Type', image.contentType)
      .set('Cache-Control', 'public, max-age=86400')
      .set('X-Content-Type-Options', 'nosniff')
      // SVG placeholders must not run scripts even if opened directly.
      .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(image.data);
  });

  return router;
}
