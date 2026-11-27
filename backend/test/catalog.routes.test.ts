import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import type { Product } from '../src/contract.js';
import { UpstreamError, type ProductRepository } from '../src/repositories/ProductRepository.js';
import { buildTestApp } from './helpers.js';

// Fixture data is a snapshot of Fake Store /products (20 items, 4 categories).
const { app } = buildTestApp();

describe('GET /api/products/featured', () => {
  it('returns the 5 top-rated products in rank order', async () => {
    const res = await request(app).get('/api/products/featured').expect(200);
    const products: Product[] = res.body.products;
    expect(products).toHaveLength(5);
    expect(products.map((p) => p.id)).toEqual([12, 11, 3, 18, 5]);
    const rates = products.map((p) => p.rating.rate);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });

  it('honours a configured featured count', async () => {
    const { app: small } = buildTestApp({ config: { featuredCount: 2 } });
    const res = await request(small).get('/api/products/featured').expect(200);
    expect(res.body.products).toHaveLength(2);
  });
});

describe('GET /api/categories', () => {
  it('lists the four Fake Store categories with URL-safe slugs', async () => {
    const res = await request(app).get('/api/categories').expect(200);
    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual([
      'electronics',
      'jewelery',
      'mens-clothing',
      'womens-clothing',
    ]);
  });
});

describe('GET /api/categories/:slug/products', () => {
  it('returns featured and additional products for the category', async () => {
    const res = await request(app).get('/api/categories/mens-clothing/products').expect(200);
    expect(res.body.category).toEqual({ slug: 'mens-clothing', name: "men's clothing" });
    expect(res.body.featured).toHaveLength(3);
    expect(res.body.others).toHaveLength(1);
    const all: Product[] = [...res.body.featured, ...res.body.others];
    expect(all.every((p) => p.category.slug === 'mens-clothing')).toBe(true);
    expect(res.body.featured[0].id).toBe(3); // 4.7 from 500 ratings
  });

  it('404s for an unknown category', async () => {
    const res = await request(app).get('/api/categories/garden/products').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404s for a malformed slug instead of passing it on', async () => {
    await request(app).get('/api/categories/..%2Fetc/products').expect(404);
  });
});

describe('GET /api/products?q=', () => {
  it('returns only matching products', async () => {
    const res = await request(app).get('/api/products').query({ q: 'backpack' }).expect(200);
    expect(res.body.query).toBe('backpack');
    expect(res.body.products.map((p: Product) => p.id)).toEqual([1]);
  });

  it('is case-insensitive and trims', async () => {
    const res = await request(app).get('/api/products').query({ q: '  SSD  ' }).expect(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    for (const p of res.body.products as Product[]) {
      expect(`${p.title} ${p.description}`.toLowerCase()).toContain('ssd');
    }
  });

  it('returns an empty list when nothing matches', async () => {
    const res = await request(app).get('/api/products').query({ q: 'zzzz-no-match' }).expect(200);
    expect(res.body.products).toEqual([]);
  });

  it('rejects a missing or blank query with 400', async () => {
    const a = await request(app).get('/api/products').expect(400);
    expect(a.body.error.code).toBe('VALIDATION_ERROR');
    await request(app).get('/api/products').query({ q: '   ' }).expect(400);
  });

  it('rejects an overly long query', async () => {
    await request(app).get('/api/products').query({ q: 'x'.repeat(101) }).expect(400);
  });

  it('accepts a query of exactly 100 characters', async () => {
    await request(app).get('/api/products').query({ q: 'x'.repeat(100) }).expect(200);
  });

  it('rejects a repeated q parameter with 400', async () => {
    await request(app).get('/api/products?q=men&q=women').expect(400);
  });

  const searchIds = async (q: string) => {
    const res = await request(app).get('/api/products').query({ q }).expect(200);
    return (res.body.products as Product[]).map((p) => p.id).sort((a, b) => a - b);
  };
  const MENS = [1, 2, 3, 4];
  const WOMENS = [15, 16, 17, 18, 19, 20];

  it.each(['men', 'mens', "men's", 'men’s', 'MEN'])(
    '%j returns only men’s products, never women’s',
    async (q) => {
      expect(await searchIds(q)).toEqual(MENS);
    },
  );

  it.each(['women', 'womens', "women's", 'women’s'])(
    '%j returns women’s clothing and the women’s bracelet',
    async (q) => {
      expect(await searchIds(q)).toEqual([5, ...WOMENS]);
    },
  );

  it('combines terms with AND', async () => {
    expect(await searchIds('women jacket')).toEqual([15, 16, 17]);
    expect(await searchIds('men jacket')).toEqual([3]);
  });

  it('matches hyphenated and spaced forms of the same word', async () => {
    expect(await searchIds('t-shirt')).toEqual([2, 20]);
    expect(await searchIds('t shirt')).toEqual([2, 20]);
    expect(await searchIds('tshirt')).toEqual([2, 20]);
  });

  it('returns results in top-rated order', async () => {
    const res = await request(app).get('/api/products').query({ q: 'gold' }).expect(200);
    const rates = (res.body.products as Product[]).map((p) => p.rating.rate);
    expect(rates.length).toBeGreaterThan(1);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });

  it.each(['(', '.*', 'a|b', '\\'])('handles special characters in %j without error', async (q) => {
    await request(app).get('/api/products').query({ q }).expect(200);
  });

  it('returns an empty list for punctuation-only input', async () => {
    expect(await searchIds('!!!')).toEqual([]);
  });
});

describe('GET /api/products/:id', () => {
  it('returns the product', async () => {
    const res = await request(app).get('/api/products/1').expect(200);
    expect(res.body).toMatchObject({ id: 1, imageUrl: '/api/images/1' });
    expect(res.body.category.slug).toBe('mens-clothing');
  });

  it.each(['999', 'abc', '-1', '1.5'])('404s for id %s', async (id) => {
    await request(app).get(`/api/products/${id}`).expect(404);
  });
});

describe('GET /api/images/:id', () => {
  it('serves image bytes from the repository on our origin', async () => {
    const res = await request(app).get('/api/images/1').expect(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('404s for an unknown product', async () => {
    await request(app).get('/api/images/999').expect(404);
  });
});

describe('error handling', () => {
  it('maps an upstream failure to 502 without leaking details', async () => {
    const failing: ProductRepository = {
      listAll: async () => {
        throw new UpstreamError('Fake Store responded 500 for https://fakestoreapi.com/products');
      },
      getById: async () => null,
      getImage: async () => null,
    };
    const { app: broken } = buildTestApp({ repo: failing });
    const res = await request(broken).get('/api/products/featured').expect(502);
    expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('fakestoreapi');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('exposes a health check that does not depend on upstream', async () => {
    const res = await request(app).get('/healthz').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
