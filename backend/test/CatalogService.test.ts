import { describe, expect, it } from '@jest/globals';
import { categorySlug } from '../src/domain/product.js';
import { FixtureProductRepository } from '../src/repositories/FixtureProductRepository.js';
import { CatalogService } from '../src/services/CatalogService.js';
import { product } from './helpers.js';

const options = { featuredCount: 2, categoryFeaturedCount: 1 };

describe('categorySlug', () => {
  it.each([
    ["men's clothing", 'mens-clothing'],
    ["women's clothing", 'womens-clothing'],
    ['electronics', 'electronics'],
    ['  Home & Garden ', 'home-garden'],
  ])('%s -> %s', (name, slug) => {
    expect(categorySlug(name)).toBe(slug);
  });
});

describe('CatalogService', () => {
  const repo = new FixtureProductRepository([
    product({ id: 1, rating: { rate: 4.8, count: 10 }, category: 'a' }),
    product({ id: 2, rating: { rate: 4.8, count: 400 }, category: 'a' }),
    product({ id: 3, rating: { rate: 2.0, count: 900 }, category: "b's" }),
    product({ id: 4, rating: { rate: 4.9, count: 1 }, category: 'a' }),
  ]);
  const catalog = new CatalogService(repo, options);

  it('ranks featured by rating, then rating count', async () => {
    const featured = await catalog.getFeatured();
    expect(featured.map((p) => p.id)).toEqual([4, 2]);
  });

  it('splits a category into featured and others, both in rank order', async () => {
    const result = await catalog.getCategoryProducts('a');
    expect(result?.category).toEqual({ slug: 'a', name: 'a' });
    expect(result?.featured.map((p) => p.id)).toEqual([4]);
    expect(result?.others.map((p) => p.id)).toEqual([2, 1]);
  });

  it('returns null for an unknown category', async () => {
    expect(await catalog.getCategoryProducts('nope')).toBeNull();
  });

  it('lists unique categories with slugs', async () => {
    expect(await catalog.getCategories()).toEqual([
      { slug: 'a', name: 'a' },
      { slug: 'bs', name: "b's" },
    ]);
  });

  it('exposes a same-origin image URL, never the upstream one', async () => {
    const p = await catalog.getProduct(1);
    expect(p?.imageUrl).toBe('/api/images/1');
    expect(JSON.stringify(p)).not.toContain('fakestoreapi.com');
  });
});

describe('CatalogService.search', () => {
  const repo = new FixtureProductRepository([
    product({ id: 1, title: 'Blue Cotton Jacket', description: 'warm', category: 'clothing' }),
    product({ id: 2, title: 'Red Jacket', description: 'Waterproof cotton shell', category: 'clothing' }),
    product({ id: 3, title: 'SSD Drive', description: 'fast storage', category: 'electronics' }),
  ]);
  const catalog = new CatalogService(repo, options);
  const ids = async (q: string) => (await catalog.search(q)).map((p) => p.id).sort();

  it('is case-insensitive', async () => {
    expect(await ids('JACKET')).toEqual([1, 2]);
  });

  it('matches description and category, not only title', async () => {
    expect(await ids('waterproof')).toEqual([2]);
    expect(await ids('electronics')).toEqual([3]);
  });

  it('requires every word to match', async () => {
    expect(await ids('cotton jacket')).toEqual([1, 2]);
    expect(await ids('blue waterproof')).toEqual([]);
  });

  it('returns nothing for whitespace-only input', async () => {
    expect(await ids('   ')).toEqual([]);
  });
});
